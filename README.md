# ⚙ Calculadora de Mecanizado por Desprendimiento de Material

<div align="center">

![Version](https://img.shields.io/badge/versión-1.0.0-f5a623?style=for-the-badge)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/licencia-MIT-green?style=for-the-badge)

**SPA de cálculo de parámetros de corte para mecanizado por arranque de viruta**  
_Desarrollada con HTML5, CSS3 y JavaScript puro._

<p style="margin-top:0.5em; font-size:0.9em; color:#555;">
Pontificia Universidad Javeriana · Departamento de Ingeniería Industrial<br>
Procesos de Manufactura Moderna · Primer Semestre 2026
</p>

</div>

---

## 📋 Tabla de Contenidos

- [Descripción General](#-descripción-general)
- [Operaciones Soportadas](#-operaciones-soportadas)
- [Fórmulas Implementadas](#-fórmulas-implementadas)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Uso](#-instalación-y-uso)
- [Base de Datos (data.json)](#-base-de-datos-datajson)
- [Interfaz de Usuario](#-interfaz-de-usuario)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Compatibilidad](#-compatibilidad)
- [Autores](#-autores)

---

## 📌 Descripción General

Esta aplicación web de **una sola página (SPA)** permite a operarios y estudiantes calcular automáticamente los tres parámetros fundamentales del mecanizado por desprendimiento de material:

| Variable | Símbolo | Unidad     | Descripción                  |
|----------|---------|------------|------------------------------|
| Velocidad de husillo | **S** | rev/min (rpm) | Velocidad de rotación del husillo |
| Velocidad de avance  | **F** | mm/min        | Desplazamiento de la herramienta  |
| Tiempo de mecanizado | **t** | min           | Duración estimada del corte       |

El operador solo necesita:
1. Seleccionar la **operación** (torneado, fresado o taladrado).
2. Elegir el **material de la pieza** y el **material de la herramienta**.
3. Ingresar las **dimensiones** de la pieza/herramienta.
4. Presionar **Calcular** — sin realizar ninguna operación matemática manual.

> La aplicación lee todos sus datos desde un archivo `data.json` externo, lo que permite actualizar materiales, velocidades de corte y rangos de avance sin tocar el código fuente.

---

## 🔧 Operaciones Soportadas

### ◎ Torneado
Mecanizado cilíndrico por rotación de la pieza sobre el eje del torno.

**Parámetros de entrada:**
- `D` — Diámetro de la pieza (mm)
- `L` — Longitud de corte (mm)
- `f` — Avance por revolución (mm/rev)

---

### ✦ Fresado
Mecanizado por rotación de la herramienta (fresa) sobre la pieza estática o en traslación.

**Parámetros de entrada:**
- `D`  — Diámetro de la fresa (mm)
- `L`  — Longitud de corte (mm)
- `Z`  — Número de dientes de la fresa
- `fz` — Avance por diente (mm/diente)

---

### ▼ Taladrado
Mecanizado de agujeros cilíndricos por rotación axial de la broca.

**Parámetros de entrada:**
- `D` — Diámetro de la broca (mm)
- `L` — Profundidad del agujero (mm)
- `f` — Avance por revolución (mm/rev)

---

## 📐 Fórmulas Implementadas

Todas las operaciones comparten la fórmula de velocidad de husillo y derivan el avance y el tiempo según su cinemática particular.

### Velocidad de Husillo (común)

```
S = (1000 × Vc) / (π × D)       [rev/min]
```

Donde `Vc` es la velocidad de corte en **m/min**, obtenida de la tabla interna según la combinación material de pieza + material de herramienta.

---

### Torneado

```
F = f × S                        [mm/min]
t = L / F                        [min]
```

---

### Fresado

```
F = fz × Z × S                   [mm/min]
t = L / F                        [min]
```

---

### Taladrado

```
F = f × S                        [mm/min]
t = (L + 0.3 × D) / F           [min]
```

> El término `0.3 × D` corresponde a la **aproximación de la punta de broca** (punto de entrada) conforme a la norma estándar de cálculo de tiempo en taladrado.

---

## 📁 Estructura del Proyecto

```
mecanizado-calculator/
│
├── index.html      # Estructura semántica de la SPA (sin CSS ni JS inline)
├── styles.css      # Hoja de estilos completa (23 secciones comentadas)
├── script.js       # Lógica de la aplicación (funciones documentadas con JSDoc)
├── data.json       # Base de datos de materiales, herramientas y parámetros
└── README.md       # Este archivo
```

### Responsabilidades por archivo

| Archivo | Responsabilidad |
|---------|----------------|
| `index.html` | Estructura HTML5 semántica. Define el esqueleto de los 3 pasos: selección de operación, configuración de parámetros y visualización de resultados. |
| `styles.css` | Todo el diseño visual: variables CSS, reset, layout responsivo, componentes UI, animaciones y breakpoints para móvil/tablet/escritorio. |
| `script.js` | Carga del JSON, renderizado dinámico de controles, sincronización slider↔input, cálculo de S/F/t, animación de resultados, validaciones y notificaciones. |
| `data.json` | Base de datos estructurada: 12 materiales de pieza, 4 materiales de herramienta, velocidades de corte por combinación, variables y rangos de avance por operación. |

---

## 🗄 Base de Datos (`data.json`)

El archivo `data.json` centraliza toda la información técnica de la aplicación. Su estructura es la siguiente:

```json
{
  "appInfo":             { ... },   // Metadatos de la aplicación
  "toolMaterials":       [ ... ],   // Materiales de herramienta disponibles
  "workpieceMaterials":  [ ... ],   // Materiales de pieza con velocidades de corte
  "operations":          { ... },   // Definición de operaciones, fórmulas y variables
  "passTypes":           { ... },   // Tipos de pasada con sugerencias de avance
  "unitConversions":     { ... }    // Constantes (π, unidades)
}
```

### Materiales de pieza incluidos

| Grupo | Materiales |
|-------|-----------|
| **Aceros** | Acero Suave, Medio Carbono, Alto Carbono, Inoxidable 304, Inoxidable 316 |
| **Hierros** | Fundido Gris, Fundido Nodular |
| **No Ferrosos** | Aluminio, Bronce/Latón, Cobre |
| **Especiales** | Titanio Ti-6Al-4V |
| **No Metálicos** | Plástico (Nylon / PVC) |

### Materiales de herramienta incluidos

| ID | Material |
|----|---------|
| `hss` | Acero Rápido (HSS) |
| `carburo` | Carburo Cementado |
| `ceramica` | Cerámica |
| `cbn` | CBN / Diamante |

### Cómo agregar un nuevo material

En `data.json`, agrega un objeto al array `workpieceMaterials` siguiendo esta estructura:

```json
{
  "id":       "mi_material",
  "label":    "Nombre del Material",
  "group":    "Grupo en el selector",
  "hardness": "HB 200-250",
  "cuttingSpeeds": {
    "hss":      { "torneado": 20, "fresado": 18, "taladrado": 16 },
    "carburo":  { "torneado": 80, "fresado": 65, "taladrado": 60 },
    "ceramica": { "torneado": 0,  "fresado": 0,  "taladrado": 0  },
    "cbn":      { "torneado": 0,  "fresado": 0,  "taladrado": 0  }
  }
}
```

> Usa `0` para combinaciones no recomendadas. La aplicación mostrará automáticamente una advertencia si el operador selecciona una combinación con `Vc = 0`.

### Componentes interactivos

| Componente | Comportamiento |
|------------|----------------|
| Tarjetas de operación | Selección con efecto hover + animación de ícono al activar |
| Selectores de material | Agrupados por categoría con indicador de dureza |
| Sliders + inputs | Doble control sincronizado bidireccional |
| Botones de pasada | Color semáforo: rojo (desbaste) · naranja (semiacabado) · verde (acabado) |
| Hint de avance | Aparece al seleccionar pasada, autocompleta el campo de avance |
| Tarjetas de resultado | Barra de color superior + animación de entrada al calcular |
| Toast de notificación | Confirmación/error con desaparición automática a los 3.2 s |

## 👥 Autores

Desarrollado para la **asignatura** de Procesos de Manufactura Moderna de la  **Pontificia Universidad Javeriana · Bogotá** 

```
Nombre Estudiante: _________________________________
Nombre Estudiante: _________________________________
Nombre Estudiante: _________________________________
---

## 📄 Licencia

Este proyecto fue desarrollado con fines académicos.

Uso libre para propósitos educativos con atribución correspondiente.
```