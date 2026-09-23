// Backend integration is opt-in, after the local workflows have been validated.
export const LOCAL_WORKFLOW = import.meta.env.VITE_BACKEND_ENABLED !== 'true';
