# routes/dashboard.py
from flask import Blueprint, render_template
from bson.objectid import ObjectId
from extensions import mongo
from utils import generate_wordcloud

perfil_bp = Blueprint('perfil', __name__, template_folder='../templates')

@perfil_bp.route('/perfil')
def perfil():
    return render_template('profile.html')