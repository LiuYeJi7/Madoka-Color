# BarberReserva ✂️ — Prototipo Navigable ("Madoka Color")

Este repositorio contiene el **prototipo navegable estático de alta fidelidad** desarrollado para el centro de estética **Madoka Color** (Urb. Satélite Chico, J.L.B. y Rivero, Arequipa). El sistema automatiza el flujo de reservas y la simulación de comisiones.

⚠️ **Estado del Proyecto:** Prototipo Frontend interactivo funcional. La persistencia se realiza localmente mediante `localStorage` (Simulación de estados). Falta finalizar detalles de integración con base de datos en la nube y pasarelas de pago reales.

---

## 🚀 Arquitectura y Vistas Clave

El sistema cuenta con tres entornos completamente diferenciados mediante roles:

1. **Cliente (`book.html`, `mis-reservas.html`):** Flujo de agendamiento en 4 pasos (Servicio ➡️ Estilista ➡️ Fecha/Hora ➡️ Pago Simulado). Genera un **Código QR dinámico** para la validación exprés en recepción.
2. **Administrador (`admin.html`):** Panel para Javier y Marisol con KPI en tiempo real (Ingresos netos del mes, reservas y barberos activos) junto con el cálculo automatizado de comisiones.
3. **Estilista (`dashboard.html`):** Agenda individual para el staff (Carlos Pérez y Lucía Gómez) con cambio de estado de citas (*"Completada"*, *"Cancelada"*, *"No show"*).

---

## 📊 Catálogo de Servicios Real (Madoka Color)

| Servicio | Tarifa | Duración |
| :--- | :--- | :--- |
| **Corte de cabello** | 15.00 Soles | 30 min |
| **Corte + Barba** | 22.00 Soles | 45 min |
| **Arreglo de barba** | 10.00 Soles | 20 min |
| **Tinte completo** | 45.00 Soles | 90 min |
| **Tratamiento capilar**| 30.00 Soles | 60 min |

---

## 🔑 Credenciales de Prueba (Datos Semilla)

Las cuentas están precargadas directamente en `shared.js` para la evaluación del ingeniero:

* **Administrador (Dueño):** `admin@demo.com` | Contraseña: `admin123`
* **Estilista 1 (Staff):** `carlos@demo.com` | Contraseña: `empleado123`
* **Estilista 2 (Staff):** `lucia@demo.com` | Contraseña: `empleado123`

*Nota: Para probar como Cliente, use la vista `register.html` para crear un usuario nuevo desde cero.*

---

## 🛠️ Tecnologías Utilizadas

* **Estructura:** HTML5 Semántico.
* **Estilos:** CSS3 Moderno (Variables globales, paleta oscura y adaptabilidad móvil).
* **Lógica y Datos:** JavaScript (ES6+) Nativo + `localStorage` para emulación de base de datos.
* **Integración:** QR Code API (`api.qrserver.com`) para renderizado síncrono de tickets de cita.

---

## ⚙️ Instrucciones de Uso
Al ser un proyecto **100% Frontend Estático**, no requiere configuración ni servidores en consola:
1. Descargue o clone los archivos.
2. Abra `index.html` en su navegador preferido (o use la extensión *Live Server* en VS Code).
