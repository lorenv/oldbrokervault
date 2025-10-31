#!/usr/bin/env python3
"""
Flask API Example for SDE Analyzer
Provides REST API endpoints for uploading P&L files and getting SDE analysis
"""

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from sde_analyzer import analyze_sde, SDEAnalyzer
import tempfile
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)  # Enable CORS for web app integration

# Configuration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'SDE Analyzer API'})


@app.route('/analyze-sde', methods=['POST'])
def analyze_sde_endpoint():
    """
    Analyze P&L and return SDE report
    
    Form Data:
        - file: Excel file (required)
        - company_name: Company name (optional)
    
    Returns:
        Excel file with SDE analysis
    """
    # Check if file was uploaded
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only .xlsx and .xls allowed'}), 400
    
    # Get optional company name
    company_name = request.form.get('company_name')
    
    # Save uploaded file to temp location
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_input:
        file.save(tmp_input.name)
        input_path = tmp_input.name
    
    # Generate output path
    output_filename = secure_filename(file.filename).replace('.xlsx', '_SDE.xlsx')
    output_path = os.path.join(tempfile.gettempdir(), output_filename)
    
    try:
        # Run analysis
        result = analyze_sde(
            input_path, 
            output_path, 
            company_name=company_name,
            verbose=False
        )
        
        # Return the generated file
        return send_file(
            output_path,
            as_attachment=True,
            download_name=output_filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    
    except Exception as e:
        return jsonify({
            'error': 'Analysis failed',
            'details': str(e)
        }), 500
    
    finally:
        # Cleanup temp files
        if os.path.exists(input_path):
            os.unlink(input_path)
        # Note: output file is cleaned up after send_file completes


@app.route('/analyze-sde-json', methods=['POST'])
def analyze_sde_json_endpoint():
    """
    Analyze P&L and return JSON summary (no Excel file)
    
    Form Data:
        - file: Excel file (required)
        - company_name: Company name (optional)
    
    Returns:
        JSON with analysis summary
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400
    
    company_name = request.form.get('company_name')
    
    # Save to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_input:
        file.save(tmp_input.name)
        input_path = tmp_input.name
    
    try:
        # Create analyzer
        analyzer = SDEAnalyzer(input_path, '/tmp/dummy.xlsx', company_name)
        
        # Run detection steps only
        analyzer.df_cleaned, analyzer.source_sheet_name, analyzer.col_mapping = analyzer.detect_empty_columns()
        analyzer.structure = analyzer.identify_structure(analyzer.df_cleaned, analyzer.col_mapping)
        analyzer.addbacks = analyzer.detect_addbacks(analyzer.df_cleaned, analyzer.structure)
        
        # Return summary
        return jsonify({
            'company': analyzer.company_name,
            'years': sorted(analyzer.structure['month_cols_by_year'].keys()),
            'months_by_year': {
                year: len(cols) 
                for year, cols in analyzer.structure['month_cols_by_year'].items()
            },
            'addbacks': [
                {
                    'label': ab['label'],
                    'category': ab['category']
                }
                for ab in analyzer.addbacks
            ],
            'revenue_row_found': analyzer.structure['revenue_row'] is not None,
            'noi_row_found': analyzer.structure['noi_row'] is not None
        })
    
    except Exception as e:
        return jsonify({
            'error': 'Analysis failed',
            'details': str(e)
        }), 500
    
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error"""
    return jsonify({
        'error': 'File too large',
        'max_size_mb': MAX_FILE_SIZE / (1024 * 1024)
    }), 413


if __name__ == '__main__':
    # For development
    app.run(debug=True, host='0.0.0.0', port=5000)
    
    # For production, use:
    # gunicorn -w 4 -b 0.0.0.0:5000 flask_api_example:app
