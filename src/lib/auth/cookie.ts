// Nombre de la cookie de sesión. Módulo aparte para que el proxy lo use sin
// importar session.ts (que arrastra next/headers y el cliente de la API).
export const COOKIE_NAME = 'contable_token';
