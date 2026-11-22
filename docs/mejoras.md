# Mejoras pendientes

Ideas surgidas al usar el panel. Ninguna es urgente.

## Vencimientos

### Marcar como presentado desde el listado
Hoy hay que entrar al detalle de cada vencimiento para marcarlo como presentado.
Agregar en cada fila de las pestañas Vencidos, Pendientes y Próximos 30 días un
botón "Marcar como presentado" que use la fecha de hoy. Para otra fecha, se sigue
usando el detalle.
- Solo dashboard: la API ya lo permite (`PATCH /vencimientos/:id`).

### Distinguir "presentado a tiempo" de "presentado tarde"
Un vencimiento presentado después de su fecha de vencimiento suele implicar
multas o intereses. Mostrarlo en el listado y en el detalle (por ejemplo, un
badge "Presentado tarde") comparando `fechaPresentacion` con `fechaVencimiento`.
- Solo dashboard: las dos fechas ya vienen en la respuesta.
- Opcional en la API: un conteo de "presentados tarde" en `/estadisticas`.

### Editar la fecha de vencimiento
Hoy, si la fecha se cargó mal, hay que borrar el vencimiento y crearlo de nuevo.
- API: que `PATCH /vencimientos/:id` acepte `fechaVencimiento`.
- Dashboard: el campo en el detalle.
