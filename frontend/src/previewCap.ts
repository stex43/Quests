// Max rows rendered in a "completed today" preview. Mirrors PREVIEW_CAP in backend/src/response_building.py,
// which caps `recent_completed` the same way; client state is not capped, only the render.
export const PREVIEW_CAP = 5;
