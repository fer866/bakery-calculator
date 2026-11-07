# Guía y Reglas del Proyecto — Bakery Calculator (Antigravity)

Este repositorio corresponde a **Bakery Calculator (Paulicious Bakery)**, una PWA modular de costeo de repostería desarrollada para Erik Fernando Pérez Díaz.

---

## 1. Repositorio Remoto y Estado de Versionado
* **Repositorio en GitHub:** `https://github.com/fer866/bakery-calculator`
* **Propietario / Usuario:** `fer866`
* **Rama Principal:** `main`
* **Configuración Git:** Usuario `Erik Pérez` (`fer866@gmail.com`)

---

## 2. Regla Obligatoria para Cambios Realizados por Agentes

> [!IMPORTANT]
> **PROTOCOLO DE VERSIONADO TRAS MODIFICACIONES:**
> Cada vez que un agente o asistente realice cambios, implemente nuevas funciones o corrija errores en el código o documentación de este proyecto:
>
> 1. **No dar por terminada la tarea sin consultar el destino de versionado.**
> 2. **Solicitar explícitamente confirmación al usuario** sobre cómo desea integrar los cambios a GitHub:
>    * **Opción A (Commit directo a `main`):** Hacer commit en la rama `main` y empujar directamente a `origin main`.
>    * **Opción B (Rama de Pull Request):** Crear una nueva rama feature/fix (ej. `feature/nueva-funcionalidad` o `fix/correccion`), confirmar los cambios, empujar la rama a GitHub y proveer el enlace para abrir un Pull Request hacia `main`.
> 3. **Proponer siempre un mensaje de commit semántico** y el nombre de la rama antes de ejecutar el push.

---

## 3. Normas Técnicas y de Arquitectura
* **Cero JavaScript inline:** Ninguna etiqueta `<script>` con código incrustado en `index.html`. Toda lógica debe residir en módulos ES en `/js`.
* **Ciclo de vida PWA:** Al alterar archivos de frontend (HTML, CSS, JS), actualizar la constante de caché en `sw.js` y verificar que los recursos precacheados coincidan.
* **Contexto LLM:** Mantener sincronizado `llms.txt` si se alteran fórmulas, insumos semilla o la estructura del proyecto.
* **Estilo y Temas:** Usar siempre tokens semánticos nativos `light-dark()` y `color-scheme` en `css/styles.[hash].css`.
