#!/usr/bin/env python3
"""Parsea los CSV exportados del Sheet maestro y genera data/data.json para el dashboard."""
import csv
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def read_csv(name):
    path = os.path.join(DATA_DIR, name)
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.reader(f))


def to_float(s):
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def parse_plan_ventas(rows):
    out = {"mermeladas": [], "snacks": []}
    # Mermeladas: filas 5-14 (idx 4-13), columnas Año,Unidades,Mercado,Crecimiento,ARS,USD
    for r in rows[4:14]:
        if len(r) >= 6 and r[0]:
            out["mermeladas"].append({
                "anio": int(to_float(r[0])),
                "unidades": to_float(r[1]),
                "mercado": to_float(r[2]),
                "usd": to_float(r[5]),
            })
    # Snacks: filas 25-34 (idx 24-33)
    for r in rows[24:34]:
        if len(r) >= 6 and r[0]:
            out["snacks"].append({
                "anio": int(to_float(r[0])),
                "unidades": to_float(r[1]),
                "mercado": to_float(r[2]),
                "usd": to_float(r[5]),
            })
    return out


def parse_cap(rows):
    """Extrae aprovechamiento y maquinas por seccion para cada bloque de horizonte."""
    bloques = []
    current = None
    for r in rows:
        if not r:
            continue
        cell0 = r[0].strip() if r[0] else ""
        if cell0.startswith("===") and "CAP — LÍNEA" in cell0:
            current = {"titulo": cell0.strip("= ").strip(), "secciones": []}
            bloques.append(current)
        elif current is not None and cell0 and cell0 not in ("Sección",) and len(r) >= 8:
            # filas de datos: Sección, Unidad, Requerido, CapReal, MaqNeces, Redondeo, CapTotal, Aprov
            req = to_float(r[2])
            if req is not None:
                current["secciones"].append({
                    "seccion": cell0,
                    "unidad": r[1],
                    "requerido": req,
                    "maquinas": to_float(r[5]),
                    "aprovechamiento": to_float(r[7]),
                })
    return bloques


def parse_guerchet(rows):
    out = {"mermeladas": [], "snacks": [], "auxiliares": [], "totales": {}}
    section = None
    for r in rows:
        if not r:
            continue
        c0 = r[0].strip() if r[0] else ""
        if "LÍNEA MERMELADAS" in c0:
            section = "mermeladas"
        elif "LÍNEA SNACKS" in c0:
            section = "snacks"
        elif "EQUIPOS AUXILIARES" in c0:
            section = "auxiliares"
        elif c0 == "Sección" or c0 == "Equipo":
            continue
        elif c0.startswith("TOTAL"):
            tot = to_float(r[9]) if len(r) > 9 else None
            sector_total = to_float(r[10]) if len(r) > 10 else None
            out["totales"][c0] = sector_total if sector_total else tot
        elif section and c0 and len(r) >= 11:
            stotal = to_float(r[10])
            if stotal is not None:
                out[section].append({"nombre": c0, "m2": stotal, "maquinas": to_float(r[1])})
    return out


def parse_rel(rows):
    sectores = []
    relaciones_x = []
    in_table = False
    in_x = False
    for r in rows:
        if not r:
            continue
        c0 = r[0].strip() if r[0] else ""
        if c0 == "Código" and len(r) > 1 and r[1].strip() == "Nombre":
            in_table = True
            in_x = False
            continue
        if in_table:
            if not r[0] or r[0].startswith("TOTAL") or r[0].startswith("RELACIONES"):
                in_table = False
                continue
            if len(r) >= 4:
                sectores.append({
                    "codigo": r[0],
                    "nombre": r[1],
                    "zona": r[2],
                    "m2": to_float(r[3]),
                })
        if c0.startswith("RELACIONES X"):
            in_x = True
            continue
        if in_x:
            if c0 == "Sector A" or not c0:
                if not c0:
                    in_x = False
                continue
            if c0.startswith("ZONIFICACIÓN"):
                in_x = False
                continue
            if len(r) >= 3:
                relaciones_x.append({"a": r[0], "b": r[1], "motivo": r[2]})
    return {"sectores": sectores, "relaciones_x": relaciones_x}


def parse_carga_distancia(rows):
    out = {"coordenadas": {}, "flujos_a": [], "flujos_e": []}
    section = None
    for r in rows:
        if not r:
            continue
        c0 = r[0].strip() if r[0] else ""
        if c0 == "COORDENADAS DE CENTROIDES — Layout 0 (m)":
            section = "coords"
            continue
        if c0 == "FLUJOS Y CARGA-DISTANCIA — pares con flujo de materiales (relación A)":
            section = "flujos_a"
            continue
        if c0.startswith("RELACIONES E (control de calidad)"):
            section = "flujos_e"
            continue
        if c0.startswith("LAYOUT 1"):
            section = "coords"  # overrides (e.g. S13 reubicado)
            continue
        if c0.startswith("RECÁLCULO RELACIONES E") or c0.startswith("ÍNDICE") or c0.startswith("ITERACIÓN"):
            section = None
        if c0 == "Sector" and len(r) > 1 and "x" in r[1]:
            continue
        if c0 == "Sector A":
            continue

        if section == "coords" and len(r) >= 3 and c0:
            x, y = to_float(r[1]), to_float(r[2])
            if x is not None and y is not None:
                key = c0.replace(" (nueva posición)", "")
                out["coordenadas"][key] = {"x": x, "y": y}
        elif section in ("flujos_a", "flujos_e") and len(r) >= 3 and c0:
            fij = to_float(r[2])
            if fij is not None:
                out[section].append({"a": c0, "b": r[1], "fij": fij})

        if c0 == "C0 (relaciones A)":
            out["C0_A"] = to_float(r[1])
        elif c0 == "C0 (relaciones E)":
            out["C0_E"] = to_float(r[1])
        elif c0 == "C0 TOTAL":
            out["C0_TOTAL"] = to_float(r[1])
        elif c0 == "C1 (relaciones A, sin cambios)":
            out["C1_A"] = to_float(r[1])
        elif c0 == "C1 (relaciones E, recalculado)":
            out["C1_E"] = to_float(r[1])
        elif c0 == "C1 TOTAL":
            out["C1_TOTAL"] = to_float(r[1])
    return out


def parse_fichas(rows):
    out = {"mermeladas": [], "snacks": [], "auxiliares": []}
    section = None
    for r in rows:
        if not r:
            continue
        c0 = r[0].strip() if r[0] else ""
        if "LÍNEA MERMELADAS" in c0:
            section = "mermeladas"
        elif "LÍNEA SNACKS" in c0:
            section = "snacks"
        elif "EQUIPOS AUXILIARES" in c0:
            section = "auxiliares"
        elif c0 in ("Sección", "Equipo"):
            continue
        elif section and c0 and len(r) >= 3:
            if section == "auxiliares":
                out[section].append({
                    "seccion": c0,
                    "equipo": r[1],
                    "ancho": to_float(r[2]) if len(r) > 2 else None,
                    "largo": to_float(r[3]) if len(r) > 3 else None,
                    "alto": to_float(r[4]) if len(r) > 4 else None,
                    "cantidad": to_float(r[5]) if len(r) > 5 else None,
                    "fuente": r[6] if len(r) > 6 else "",
                    "foto": r[7] if len(r) > 7 else "",
                })
            else:
                out[section].append({
                    "seccion": c0,
                    "equipo": r[1],
                    "marca": r[2],
                    "ancho": to_float(r[3]) if len(r) > 3 else None,
                    "largo": to_float(r[4]) if len(r) > 4 else None,
                    "alto": to_float(r[5]) if len(r) > 5 else None,
                    "peso": r[6] if len(r) > 6 else "",
                    "potencia": r[7] if len(r) > 7 else "",
                    "cap_teorica": r[8] if len(r) > 8 else "",
                    "unidad": r[9] if len(r) > 9 else "",
                    "rendimiento": to_float(r[10]) if len(r) > 10 else None,
                    "cantidad": to_float(r[11]) if len(r) > 11 else None,
                    "precio": r[12] if len(r) > 12 else "",
                    "fuente": r[13] if len(r) > 13 else "",
                    "foto": r[14] if len(r) > 14 else "",
                })
    return out


def parse_materia_prima(rows):
    out = {"mermeladas": [], "snacks": []}
    section = None
    for i, r in enumerate(rows):
        if not r:
            continue
        c0 = r[0].strip() if r[0] else ""
        if "BALANCE DE MATERIA PRIMA — MERMELADAS" in c0:
            section = "mermeladas"
            continue
        if "BALANCE DE MATERIA PRIMA — SNACKS" in c0:
            section = "snacks"
            continue
        if c0 == "Etapa" and section:
            continue
        if section and c0 and len(r) >= 4:
            a1, a2, a3 = to_float(r[1]), to_float(r[2]), to_float(r[3])
            if a1 is not None:
                out[section].append({"etapa": c0, "anio1": a1, "anio_mid": a2, "anio_final": a3})
            else:
                section = None if c0.startswith("Desglose") else section
    return out


def read_json(name):
    path = os.path.join(DATA_DIR, name)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return []


data = {
    "plan_ventas": parse_plan_ventas(read_csv("plan-de-ventas.csv")),
    "cap": parse_cap(read_csv("cap.csv")),
    "guerchet": parse_guerchet(read_csv("guerchet.csv")),
    "rel": parse_rel(read_csv("rel.csv")),
    "carga_distancia": parse_carga_distancia(read_csv("carga-distancia.csv")),
    "fichas_tecnicas": parse_fichas(read_csv("fichas-tecnicas.csv")),
    "materia_prima": parse_materia_prima(read_csv("materia-prima.csv")),
    "materia_prima_fichas": read_json("materia-prima-fichas.json"),
    "producto_fichas": read_json("producto-terminado-fichas.json"),
}

t = data["guerchet"]["totales"]
t["TOTAL PRODUCTIVO NETO"] = round(
    (t.get("TOTAL MERMELADAS") or 0) + (t.get("TOTAL SNACKS") or 0) + (t.get("TOTAL AUXILIARES") or 0), 3
)

out_path = os.path.join(DATA_DIR, "data.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"OK -> {out_path}")
print("Plan ventas mermeladas:", len(data["plan_ventas"]["mermeladas"]))
print("CAP bloques:", len(data["cap"]))
print("REL sectores:", len(data["rel"]["sectores"]))
print("Carga-distancia coords:", len(data["carga_distancia"]["coordenadas"]))
