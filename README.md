# Carley World Engine

## Descripción General

**Carley World Engine** es una aplicación web de animación 3D diseñada desde cero. El objetivo es crear una herramienta inspirada en aplicaciones profesionales como Blender o Unity, pero con un enfoque en la simplicidad y la facilidad de uso para crear animaciones sencillas y grabar escenas.

Este proyecto se está construyendo con **HTML, CSS y JavaScript vainilla**, utilizando **WebGL** puro para el renderizado 3D, sin depender de librerías o motores de terceros.

## Objetivos del Proyecto

- **Interfaz Modular:** Una interfaz de usuario flexible con paneles para la jerarquía de la escena, el visor 3D y un inspector de propiedades.
- **Cámara de Vuelo Libre:** A diferencia de las cámaras orbitales tradicionales, el usuario puede moverse libremente por la escena como en un videojuego, utilizando las teclas WASD y el ratón.
- **Facilidad de Uso:** Simplificar el proceso de animación 3D, haciéndolo accesible para principiantes.
- **Motor 3D Personalizado:** Construir un motor de renderizado 3D desde cero para tener un control total sobre la funcionalidad y el rendimiento.

## Arquitectura Actual

El proyecto está organizado con una clara separación entre la aplicación principal y el motor de renderizado.

```
/
├── engine/
│   ├── camera.js       # Gestiona la posición, rotación y matriz de vista de la cámara.
│   ├── gameObject.js   # Define la clase GameObject, la base para todos los objetos en la escena.
│   ├── input.js        # Maneja la entrada del teclado (WASD) y el ratón (movimiento de la cámara).
│   ├── math.js         # Re-exporta la librería gl-matrix desde una CDN para cálculos de vectores y matrices.
│   ├── mesh.js         # Define la geometría (vértices, índices) y gestiona los buffers de WebGL.
│   ├── renderer.js     # Contiene la lógica de bajo nivel para inicializar WebGL y renderizar la escena.
│   └── scene.js        # Gestiona la colección de GameObjects que componen la escena.
│
├── engine.js           # Actúa como la API principal del motor, unificando todos los sub-módulos.
├── main.js             # El punto de entrada de la aplicación. Inicializa el motor, crea la escena y los objetos.
├── style.css           # Define la apariencia de la interfaz de usuario, incluyendo el layout de 3 columnas.
└── index.html          # La estructura principal de la página web que aloja la aplicación.
```

## Cómo Ejecutar el Proyecto

Debido a que el proyecto utiliza Módulos de JavaScript (`import`/`export`), no puede ejecutarse abriendo el archivo `index.html` directamente en el navegador. Es necesario servir los archivos a través de un servidor web local.

1.  **Abre una terminal** en el directorio raíz del proyecto.
2.  **Inicia un servidor web local.** La forma más sencilla de hacerlo es con Python:
    ```bash
    python3 -m http.server 8000
    ```
3.  **Abre tu navegador web** y navega a la siguiente dirección:
    ```
    http://localhost:8000
    ```

La aplicación debería cargarse, mostrando tres cubos en el visor 3D y sus nombres en el panel de "Jerarquía".
