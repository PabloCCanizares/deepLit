# routes/dashboard.py
from flask import Blueprint, render_template
from bson.objectid import ObjectId
from extensions import mongo
from utils import generate_wordcloud

colecciones_bp = Blueprint('colecciones', __name__, template_folder='../templates')

@colecciones_bp.route('/colecciones')
def colecciones():
    return render_template('colections.html')