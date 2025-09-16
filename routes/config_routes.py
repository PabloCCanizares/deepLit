# routes/config_routes.py
from flask import Blueprint, render_template, request, redirect, url_for, flash
from extensions import mongo

config_bp = Blueprint('config_routes', __name__)

@config_bp.route('/config', methods=['GET', 'POST'])
def config():
    if request.method == 'POST':
        new_config = {
            "order_by_year": request.form.get("order_by_year", "asc"),
            "required_fields": request.form.getlist("required_fields")
        }
        mongo.db.configuration.update_one({"_id": "settings"}, {"$set": new_config}, upsert=True)
        flash("Configuración actualizada correctamente")
        return redirect(url_for('config_routes.config'))
    
    config_data = mongo.db.configuration.find_one({"_id": "settings"}) or {"order_by_year": "asc", "required_fields": []}
    sample_doc = mongo.db.documents.find_one() or {}
    excluded = {"_id", "upload_date"}
    available_fields = [key for key in sample_doc.keys() if key not in excluded]
    available_fields.sort()
    
    return render_template("config.html", config=config_data, available_fields=available_fields)

@config_bp.route('/save_config', methods=['POST'])
def save_config():
    data = request.get_json()
    required_fields = data.get("required_fields", [])
    config_doc = {"_id": "settings", "required_fields": required_fields}
    mongo.db.configuration.replace_one({"_id": "settings"}, config_doc, upsert=True)
    return {"status": "success"}, 200

@config_bp.route('/save_sort_order', methods=['POST'])
def save_sort_order():
    data = request.get_json()
    sort_order = data.get("sort_order", "asc")
    mongo.db.configuration.update_one(
        {"_id": "settings"},
        {"$set": {"order_by_year": sort_order}},
        upsert=True
    )
    return {"status": "success", "sort_order": sort_order}

