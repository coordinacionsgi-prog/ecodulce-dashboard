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
    in_table = False
    for r in rows:
        if not r:
            continue
        if r[0].strip() == "Código" and len(r) > 1 and r[1].strip() == "Nombre":
            in_table = True
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
    return sectores


def parse_carga_distancia(rows):
    out = {}
    for r in rows:
        if not r:
            continue
        c0 = r[0].strip() if r[0] else ""
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
            out[section].append({
                "seccion": c0,
                "equipo": r[1],
                "marca": r[2],
                "ancho": to_float(r[3]) if len(r) > 3 else None,
                "largo": to_float(r[4]) if len(r) > 4 else None,
                "cantidad": to_float(r[11]) if section != "auxiliares" and len(r) > 11 else (to_float(r[5]) if len(r) > 5 else None),
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


data = {
    "plan_ventas": parse_plan_ventas(read_csv("plan-de-ventas.csv")),
    "cap": parse_cap(read_csv("cap.csv")),
    "guerchet": parse_guerchet(read_csv("guerchet.csv")),
    "rel": parse_rel(read_csv("rel.csv")),
    "carga_distancia": parse_carga_distancia(read_csv("carga-distancia.csv")),
    "fichas_tecnicas": parse_fichas(read_csv("fichas-tecnicas.csv")),
    "materia_prima": parse_materia_prima(read_csv("materia-prima.csv")),
}

out_path = os.path.join(DATA_DIR, "data.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"OK -> {out_path}")
print("Plan ventas mermeladas:", len(data["plan_ventas"]["mermeladas"]))
print("CAP bloques:", len(data["cap"]))
print("REL sectores:", len(data["rel"]))
print("Carga-distancia:", data["carga_distancia"])
