# routes/dashboard.py
from flask import Blueprint, render_template
from bson.objectid import ObjectId
from extensions import mongo
from utils import generate_wordcloud

historial_bp = Blueprint('historial', __name__, template_folder='../templates')

@historial_bp.route('/historial')
def historial():
    return render_template('history.html')