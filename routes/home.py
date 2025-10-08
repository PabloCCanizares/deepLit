# routes/dashboard.py
from flask import Blueprint, render_template, redirect, url_for
from bson.objectid import ObjectId
from extensions import mongo
from utils import generate_wordcloud

inicio_bp = Blueprint('inicio', __name__, template_folder='../templates')

@inicio_bp.route('/inicio')
def inicio():
    return render_template('inicio.html')

@inicio_bp.route('/')
def root():
    return redirect(url_for('inicio.inicio'))