import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src import models, recurrence, schemas


class ArcRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, title: str) -> models.Arc:
        arc = models.Arc(title=title)
        self.db.add(arc)
        return arc

    def get_all(self) -> list[models.Arc]:
        # Newest first, matching the client prepending new arcs; id breaks timestamp ties.
        stmt = (
            select(models.Arc)
            .options(selectinload(models.Arc.quests))
            .order_by(models.Arc.created_at.desc(), models.Arc.id.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get(self, arc_id: uuid.UUID) -> models.Arc | None:
        return self.db.get(models.Arc, arc_id)

    def update(self, arc: models.Arc, title: str) -> None:
        arc.title = title

    def delete(self, arc: models.Arc) -> None:
        self.db.delete(arc)

    def seal(self, arc: models.Arc) -> None:
        arc.sealed_at = datetime.now(UTC)

    def unseal(self, arc: models.Arc) -> None:
        arc.sealed_at = None


class QuestRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        title: str,
        description: str,
        arc_id: uuid.UUID,
        rule: schemas.RecurrenceRule | None = None,
        today: date | None = None,
    ) -> models.Quest:
        quest = models.Quest(title=title, description=description, arc_id=arc_id)
        if rule is not None:
            self.set_recurrence(quest, rule, today or recurrence.local_today(None))
        self.db.add(quest)
        return quest

    def get(self, quest_id: uuid.UUID) -> models.Quest | None:
        return self.db.get(models.Quest, quest_id)

    def update(self, quest: models.Quest, title: str | None, description: str | None, arc_id: uuid.UUID | None) -> None:
        # None means "omitted — skip this field". Callers must reject explicit null before calling this.
        if title is not None:
            quest.title = title
        if description is not None:
            quest.description = description
        if arc_id is not None:
            quest.arc_id = arc_id

    def set_recurrence(self, quest: models.Quest, rule: schemas.RecurrenceRule, today: date) -> None:
        # Callers must only pass open quests. Changing an existing rule keeps the series (and
        # its completed history) and re-anchors it from the first day not yet covered by that
        # history: today, unless an instance done today or early (due later) already covers it,
        # so a rule change never re-schedules an occurrence that is already done.
        start = today
        if quest.series_id is None:
            quest.series_id = uuid.uuid4()
        else:
            done_through = self._latest_done_day(quest.series_id)
            if done_through is not None and done_through >= today:
                start = done_through + timedelta(days=1)
        stored = recurrence.to_stored(rule, start)
        quest.recurrence = recurrence.dump_stored(stored)
        quest.due_on = recurrence.first_on_or_after(stored, start)

    def clear_recurrence(self, quest: models.Quest) -> None:
        # Stop repeating: the quest becomes a plain, always-visible quest. Completed instances
        # keep their series_id/rule as history.
        quest.recurrence = None
        quest.series_id = None
        quest.due_on = None

    def complete(self, quest: models.Quest, utc_offset_minutes: int | None = None) -> models.Quest | None:
        """Mark the quest completed; returns the series' newly spawned next instance, if any."""
        # Only stamp on the incomplete -> complete transition, so re-completing an
        # already-completed quest preserves the original date (and spawns nothing).
        if quest.completed:
            return None
        today = recurrence.local_today(utc_offset_minutes)
        quest.completed = True
        quest.completed_on = today
        if quest.series_id is None or quest.recurrence is None:
            return None
        # The completed flag must reach the DB before the next open instance does, or the
        # uq_quests_open_series index sees two open instances. The unit of work happens to emit
        # a table's UPDATEs before its INSERTs today, but does not document that order.
        self.db.flush()
        # Fixed calendar schedule: the next occurrence after whichever is later, today or the
        # current due day. Late completion skips missed dates; early completion skips past
        # the current one.
        stored = recurrence.load_stored(quest.recurrence)
        base = max(today, quest.due_on) if quest.due_on is not None else today
        next_instance = models.Quest(
            title=quest.title,
            description=quest.description,
            arc_id=quest.arc_id,
            series_id=quest.series_id,
            # Copied as stored, not re-anchored, so the cadence's phase never drifts.
            recurrence=dict(quest.recurrence),
            due_on=recurrence.next_after(stored, base),
        )
        self.db.add(next_instance)
        return next_instance

    def uncomplete(self, quest: models.Quest) -> uuid.UUID | None:
        """Mark the quest open; returns the id of the series instance deleted to make room, if any."""
        removed_id = None
        if quest.completed and quest.series_id is not None:
            # Undo semantics only for the series' latest completed instance while the series is
            # still live: the instance spawned in its place goes away (with any edits made to
            # it), so this one becomes the series' open instance again. An older instance, or
            # one whose series was stopped or whose open instance was deleted, reopens as a
            # plain quest instead, so it neither deletes the live instance nor revives a series.
            open_stmt = select(models.Quest).where(
                models.Quest.series_id == quest.series_id,
                models.Quest.completed.is_(False),
                models.Quest.id != quest.id,
            )
            open_instance = self.db.scalars(open_stmt).first()
            if open_instance is not None and self._latest_completed_id(quest.series_id) == quest.id:
                removed_id = open_instance.id
                self.db.delete(open_instance)
                # The DELETE is flushed before the flag flips for the same index-ordering
                # reason as in complete().
                self.db.flush()
            else:
                self.clear_recurrence(quest)
        # Cleared unconditionally: also heals rows whose flag and date disagree. due_on is kept
        # on the undo path (and cleared with the rest of the rule on the plain one).
        quest.completed = False
        quest.completed_on = None
        return removed_id

    def _latest_completed_id(self, series_id: uuid.UUID) -> uuid.UUID | None:
        # The series' most recent occurrence: by due day, then completion day (NULLs sort as
        # earliest), with created_at and id breaking ties.
        stmt = (
            select(models.Quest.id)
            .where(models.Quest.series_id == series_id, models.Quest.completed.is_(True))
            .order_by(
                models.Quest.due_on.desc().nulls_last(),
                models.Quest.completed_on.desc().nulls_last(),
                models.Quest.created_at.desc(),
                models.Quest.id.desc(),
            )
            .limit(1)
        )
        return self.db.scalar(stmt)

    def _latest_done_day(self, series_id: uuid.UUID) -> date | None:
        # The last day the series' completed history covers: an instance done early covers its
        # due day, one done late covers its completion day. GREATEST skips a NULL operand.
        stmt = select(func.max(func.greatest(models.Quest.due_on, models.Quest.completed_on))).where(
            models.Quest.series_id == series_id, models.Quest.completed.is_(True)
        )
        return self.db.scalar(stmt)

    def delete(self, quest: models.Quest) -> None:
        self.db.delete(quest)

    def count_open(self, arc_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(models.Quest)
            .where(models.Quest.arc_id == arc_id, models.Quest.completed.is_(False))
        )
        return self.db.scalar(stmt) or 0

    def count_total(self, arc_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(models.Quest).where(models.Quest.arc_id == arc_id)
        return self.db.scalar(stmt) or 0
