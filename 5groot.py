import sys
import json
import os
import requests
import ollama
from dotenv import load_dotenv

load_dotenv()

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
sys.path.append(root_dir)

from funcionesbutler2 import (
    ALIAS, BUTLER_URL, MODELO,
    get_estado_actual, ver_destinatarios,
    enviar_carta, enviar_paquete,
    cargar_leidos, guardar_leidos,
    filtrar_no_leidos, marcar_como_leidos,
    print_color,
)

# =====================
# ESTADO DE CORREOS LEÍDOS (se carga desde disco al arrancar)
# =====================
correos_leidos = cargar_leidos()


# =====================
# TOOL DE ESTRUCTURA DINÁMICA
# =====================
def generar_schema_dinamico(lista_validos):
    return {
        "type": "object",
        "properties": {
            "razonamiento": {
                "type": "string",
                "description": "Explica paso a paso. IMPORTANTE: Diferencia explícitamente entre 'Lo que doy' y 'Lo que recibo'."
            },
            "accion": {
                "type": "string",
                "enum": ["proponer_trato", "cerrar_trato_y_enviar", "rechazar", "esperar"],
                "description": "Acción a realizar."
            },
            "destinatario": {
                "type": ["string", "null"],
                "enum": lista_validos + [None],
                "description": "El alias del otro agente."
            },
            "mensaje_carta": {
                "type": ["string", "null"],
                "description": "Texto de la carta."
            },
            "contenido_paquete": {
                "type": ["object", "null"],
                "description": "Recursos a enviar. OBLIGATORIO si la accion es 'cerrar_trato_y_enviar'. ¡ATENCIÓN!: Incluye SOLO lo que sale de tu inventario (lo que tú pagas). NUNCA incluyas lo que vas a recibir.",
                "additionalProperties": {"type": "integer"}
            }
        },
        "required": ["razonamiento", "accion", "destinatario", "mensaje_carta", "contenido_paquete"]
    }


# =====================
# SYSTEM PROMPT 
# =====================

SYSTEM_PROMPT = f"""
Eres {ALIAS}, un agente comerciante experto.
TU META: Conseguir los recursos listados en 'FALTANTES' (Objetivos - Inventario).

PROTOCOLO DE ACTUACIÓN:

1. FASE DE CIERRE (Prioridad Máxima):
   - Si lees un "ACEPTO" reciente o recibes un paquete -> Debes usar la acción 'cerrar_trato_y_enviar'.
   - ***REGLA DE ORO DE ENVÍO***: En 'contenido_paquete' debes poner ÚNICAMENTE los recursos que TÚ prometiste dar. 
     - EJEMPLO CORRECTO: Trato "Doy 1 Arroz por 1 Piedra" -> contenido_paquete: {{"arroz": 1}}
     - EJEMPLO ERROR FATAL: contenido_paquete: {{"arroz": 1, "piedra": 1}} (ESTO ESTÁ PROHIBIDO, estarías regalando la piedra).
     - NUNCA envíes el recurso que esperas recibir, aunque lo tengas en el inventario.

2. FASE DE NEGOCIACIÓN:
   - Si recibes una oferta -> Evalúala. Si te sirve para reducir tus 'FALTANTES', acepta o contraoferta.
   - REGLA DE INTERCAMBIO: Solo acepta o propón intercambios simples de 1 unidad por 1 unidad (1:1). 
   - Si rechazas -> Sé educado.

3. FASE DE INICIATIVA (Si el buzón está vacío):
   - ESTÁ PROHIBIDO "ESPERAR" SI TE FALTAN RECURSOS.
   - Elige un agente de la lista de 'AGENTES DISPONIBLES' al azar o por estrategia.
   - Usa 'proponer_trato' ofreciendo EXACTAMENTE 1 unidad de lo que te sobra a cambio de EXACTAMENTE 1 unidad de lo que te falta.
"""


# =====================
# CICLO PRINCIPAL
# =====================

def ejecutar_ciclo():
    print_color(f"=== AGENTE {ALIAS} INICIADO (Modo Proactivo 1:1) ===", "azul")

    while True:
        try:
            # 1. Obtener estado completo
            estado = get_estado_actual()
            mis_recursos = estado["mis_recursos"]
            mis_objetivos = estado["mis_objetivos"]
            buzon_raw = estado.get("buzon") or []

            # ── Filtrar solo correos no leídos ──────────────────────────────
            no_leidos_con_uid = filtrar_no_leidos(buzon_raw, correos_leidos)
            # Extraemos solo los correos (sin el uid) para pasarlos al prompt
            buzon = [correo for _, correo in no_leidos_con_uid]
            uids_este_turno = [uid for uid, _ in no_leidos_con_uid]

            if buzon_raw and not buzon:
                print_color(
                    f"[BUZÓN] {len(buzon_raw)} correos en total, todos ya leídos. "
                    "Tomando iniciativa.", "gris"
                )
            # ────────────────────────────────────────────────────────────────

            # 2. Calcular Faltantes (Lo que necesito - Lo que tengo)
            faltantes = {}
            sobrantes = {}  # Opcional: para saber qué ofrecer

            # Calculo de necesidades
            for recurso, cantidad_obj in mis_objetivos.items():
                cantidad_actual = mis_recursos.get(recurso, 0)
                diff = cantidad_obj - cantidad_actual
                if diff > 0:
                    faltantes[recurso] = diff

            # Calculo de sobrantes (todo lo que no es objetivo o excede el objetivo)
            for recurso, cantidad in mis_recursos.items():
                necesario = mis_objetivos.get(recurso, 0)
                if cantidad > necesario:
                    sobrantes[recurso] = cantidad - necesario

            # 3. Verificar Victoria
            if not faltantes:
                print_color("!!! OBJETIVOS CUMPLIDOS !!!", "amarillo")
                print(f"Inventario Final: {mis_recursos}")
                break

            # 4. Preparar Contexto de Agentes
            raw_destinatarios = ver_destinatarios()
            nombres_validos = []
            for agente in raw_destinatarios:
                if isinstance(agente, dict):
                    alias_agente = agente.get("alias")
                    if alias_agente and alias_agente != ALIAS:
                        nombres_validos.append(alias_agente)
                elif agente != ALIAS:
                    nombres_validos.append(agente)

            print("nombres validos", nombres_validos)
            print("estado", estado)

            # 5. Generar Prompt Dinámico (Estructura Original)

            # A) Bloque del Buzón
            if not buzon:
                print("buzon vacio (o todos ya leídos)")
                bloque_buzon = "📭 BUZÓN VACÍO. (Nadie te ha escrito o ya leíste todo)."
                instruccion_turno = (
                    f"ESTRATEGIA: No tienes mensajes nuevos. Tienes que TOMAR LA INICIATIVA. "
                    f"Elige a uno de los AGENTES DISPONIBLES: {nombres_validos} y propón un "
                    f"intercambio SIMPLE (1 unidad por 1 unidad) para conseguir {list(faltantes.keys())}."
                )
            else:
                print(f"buzon con {len(buzon)} correo(s) NO leído(s)")
                bloque_buzon = f"📬 MENSAJES NUEVOS (Lee atentamente):\n{json.dumps(buzon, indent=2)}"
                instruccion_turno = (
                    "ESTRATEGIA: Tienes mensajes pendientes. Prioriza CERRAR TRATOS (enviar paquetes) "
                    "si te han aceptado, o responder ofertas manteniendo la regla de 1 unidad por 1 unidad."
                )

            prompt_usuario = f"""
            ESTADO ACTUAL:
            - Inventario: {json.dumps(mis_recursos)}
            - OBJETIVOS (FALTANTES): {json.dumps(faltantes)}
            - Lo que me sobra para cambiar: {json.dumps(sobrantes)}
            
            {bloque_buzon}
            
            AGENTES DISPONIBLES PARA COMERCIAR:
            {json.dumps(nombres_validos)}
            
            {instruccion_turno}
            """

            # 6. Llamada al Modelo
            schema_actual = generar_schema_dinamico(nombres_validos)

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt_usuario}
            ]

            print_color(f"--- Turno: Faltan {faltantes} | Buzón nuevo: {len(buzon)} items ---", "cian")

            response = ollama.chat(
                model=MODELO,
                messages=messages,
                format=schema_actual,
                think=False
            )

            contenido = response["message"]["content"]
            try:
                decision = json.loads(contenido)
            except Exception:
                print_color("Error crítico parseando JSON del modelo", "rojo")
                continue

            # Mapeo de respuesta
            accion = decision["accion"]
            destinatario = decision["destinatario"]
            mensaje_carta = decision["mensaje_carta"]
            contenido_paquete = decision.get("contenido_paquete")
            razonamiento = decision.get("razonamiento", "")

            print(f"🧠 PENSAMIENTO: {razonamiento}")

            # ── Marcar como leídos DESPUÉS de que el modelo los procesó ────
            marcar_como_leidos(correos_leidos, uids_este_turno)
            guardar_leidos(correos_leidos)  # persiste en disco
            if uids_este_turno:
                print_color(
                    f"[LEÍDOS] {len(uids_este_turno)} correo(s) marcados como procesados "
                    f"(IDs: {uids_este_turno})", "gris"
                )
            # ────────────────────────────────────────────────────────────────

            # 7. Ejecución de Acciones
            if accion == "esperar":
                print_color(f"[ESPERAR] {razonamiento}", "gris")

            elif accion == "cerrar_trato_y_enviar":
                # Lógica de envío físico
                if contenido_paquete and destinatario:
                    # Validar existencias
                    posible = all(mis_recursos.get(k, 0) >= v for k, v in contenido_paquete.items())

                    if posible:
                        c, txt = enviar_paquete(destinatario, contenido_paquete)
                        if c == 200:
                            print_color(f"📦 PAQUETE ENVIADO a {destinatario}: {contenido_paquete}", "verde")
                            # Confirmación automática por carta para avisar al otro
                            texto_confirmacion = (
                                f"CONFIRMACION: Te acabo de enviar el paquete con "
                                f"{json.dumps(contenido_paquete)}. {mensaje_carta}"
                            )
                            enviar_carta(destinatario, "ENVIO_REALIZADO", texto_confirmacion)
                        else:
                            print_color(f"❌ ERROR ENVIO PAQUETE ({c}): {txt}", "rojo")
                    else:
                        print_color(
                            f"⚠️ NO TIENES RECURSOS SUFICIENTES para enviar: {contenido_paquete}",
                            "amarillo"
                        )
                        # Opcional: Enviar carta de disculpa
                        enviar_carta(destinatario, "ERROR", "Perdona, calculé mal y no tengo los recursos acordados.")
                else:
                    print_color("⚠️ Error de lógica: El modelo quiso enviar pero el paquete estaba vacío.", "rojo")

            elif accion in ["proponer_trato", "rechazar"]:
                # Lógica solo carta
                if destinatario and mensaje_carta:
                    s, m = enviar_carta(destinatario, accion.upper(), mensaje_carta)
                    print_color(f"✉️ CARTA a {destinatario} ({accion}): \"{mensaje_carta}\"", "azul")

        except KeyboardInterrupt:
            print("Deteniendo agente...")
            break
        except Exception as e:
            print_color(f"Error critico en el ciclo: {e}", "rojo")


if __name__ == "__main__":
    print("=== BIENVENIDO AL AGENTE DE COMERCIO AUTÓNOMO ===")

    # Lógica simple de inicio
    crear = input("¿Crear alias nuevo? :")

    if crear.lower().strip() == "si":
        mi_alias = input("Introduce tu ALIAS para esta sesión: ")
        try:
            url_registro = f"{BUTLER_URL}/alias/{mi_alias}"
            res = requests.post(url_registro)

            if res.status_code in [200, 201]:
                print(f"✓ Alias '{mi_alias}' vinculado con éxito.")
                ejecutar_ciclo()
            else:
                print(f"Error al registrar alias: {res.text}")
        except Exception as e:
            print(f"Error de conexión inicial: {e}")
    else:
        ejecutar_ciclo()