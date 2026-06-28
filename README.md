# Eco Dulce — Dashboard de Factibilidad Técnica

Dashboard visual del proyecto final Eco Dulce (UTN FRBA, I5052, Grupo 07) — Mermeladas y Snacks de fruta sin azúcar.

Generado a partir del Google Sheet maestro vinculado por fórmulas: Plan de Ventas → Materia Prima y Máquinas → CAP → Fichas Técnicas → Guerchet → REL → Carga-Distancia.

## Estructura
- `index.html` / `app.js` — dashboard estático (Chart.js)
- `data/*.csv` — export crudo de cada pestaña del Sheet
- `data/data.json` — datos procesados que consume el dashboard
- `build_data.py` — script que regenera `data.json` a partir de los CSV

## Actualizar los datos
1. Descargar los CSV actualizados desde el Sheet (cada pestaña → Archivo → Descargar → CSV), reemplazando los archivos en `data/`.
2. Correr `python3 build_data.py`.
3. Commitear y pushear.

## Ver localmente
```
python3 -m http.server 8000
```
