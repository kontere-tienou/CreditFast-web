// The SPA calls the API. Set VITE_BACKEND_ENABLED=false to use the browser store.
export const LOCAL_WORKFLOW = import.meta.env.VITE_BACKEND_ENABLED === 'false';
