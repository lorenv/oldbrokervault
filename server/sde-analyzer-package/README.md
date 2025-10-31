# SDE Analyzer - Standalone Package

Professional Seller's Discretionary Earnings (SDE) analyzer for P&L statements. Generates beautifully formatted Excel reports with formulas and complete audit trails.

## Features

✓ **Automatic Detection**
- Empty column removal
- Month/year identification
- Revenue and NOI location
- Add-back expense detection

✓ **Professional Output**
- Color-coded sections (blue headers, gray subtotals)
- Formula-based calculations (full transparency)
- Preserves all original source sheets
- Ready for stakeholders/lenders

✓ **Flexible Input**
- Monthly or annual P&L formats
- Multiple years
- Various accounting software exports
- Handles empty spacing columns

## Quick Start

### Installation

```bash
pip install -r requirements.txt
```

### Command Line Usage

```bash
# Basic usage
python sde_analyzer.py input.xlsx output.xlsx

# With company name
python sde_analyzer.py input.xlsx output.xlsx "My Company Inc"
```

### Python API Usage

```python
from sde_analyzer import analyze_sde

# Simple usage
result = analyze_sde('input.xlsx', 'output.xlsx')

# With company name and silent mode
result = analyze_sde(
    'input.xlsx', 
    'output.xlsx',
    company_name='Acme Corp',
    verbose=False
)

print(f"Analyzed {len(result['years'])} years")
print(f"Found {result['addbacks_count']} add-backs")
```

### Object-Oriented API

```python
from sde_analyzer import SDEAnalyzer

# Create analyzer
analyzer = SDEAnalyzer(
    input_file='profit_loss_2023_2024.xlsx',
    output_file='sde_analysis.xlsx',
    company_name='Tech Startup Inc'
)

# Run analysis
result = analyzer.analyze(verbose=True)

# Access details
print(f"Years: {analyzer.structure['month_cols_by_year'].keys()}")
print(f"Add-backs: {[ab['label'] for ab in analyzer.addbacks]}")
```

## Web API Integration

See `flask_api_example.py` for a complete Flask API implementation.

### Flask API Example

```python
from flask import Flask, request, send_file
from sde_analyzer import analyze_sde
import tempfile
import os

app = Flask(__name__)

@app.route('/analyze-sde', methods=['POST'])
def analyze():
    # Get uploaded file
    file = request.files['file']
    company_name = request.form.get('company_name')
    
    # Save to temp location
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_input:
        file.save(tmp_input.name)
        input_path = tmp_input.name
    
    # Generate output
    output_path = input_path.replace('.xlsx', '_SDE.xlsx')
    
    try:
        result = analyze_sde(input_path, output_path, company_name, verbose=False)
        return send_file(output_path, as_attachment=True)
    finally:
        os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)

if __name__ == '__main__':
    app.run(debug=True)
```

### FastAPI Example

```python
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
from sde_analyzer import analyze_sde
import tempfile
import os

app = FastAPI()

@app.post("/analyze-sde")
async def analyze(
    file: UploadFile = File(...),
    company_name: str = None
):
    # Save uploaded file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
        content = await file.read()
        tmp.write(content)
        input_path = tmp.name
    
    output_path = input_path.replace('.xlsx', '_SDE.xlsx')
    
    try:
        result = analyze_sde(input_path, output_path, company_name, verbose=False)
        return FileResponse(
            output_path, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename='sde_analysis.xlsx'
        )
    finally:
        os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)
```

## Input File Requirements

Your P&L Excel file should have:

- **Row labels** in first few columns (A-E)
- **Financial data** in subsequent columns
- **Revenue row** with text like "Total Income" or "Total Revenue"
- **NOI row** with text like "Net Income" or "Net Operating Income"

### Supported Formats

✓ Monthly P&L (Jan 2023, Feb 2023, etc.)
✓ Annual P&L (2022, 2023, 2024)
✓ Files with empty spacing columns
✓ QuickBooks exports
✓ Xero exports
✓ Custom formats

## Output Structure

Generated Excel file contains:

1. **SDE Analysis** (first tab)
   - Professional formatting
   - Color-coded sections
   - Formula-based calculations
   - Revenue, NOI, Add-backs, Total SDE

2. **Original Source Sheets** (remaining tabs)
   - All original data preserved
   - Complete audit trail

## Add-Back Detection

Automatically detects these expense categories:

- Depreciation & Amortization
- Owner/Officer Compensation
- Interest Expense
- Payroll Taxes (941, FUTA, SUTA)
- Bonuses
- Health & Life Insurance
- Auto/Vehicle Expenses
- Travel, Meals & Entertainment
- Legal & Professional Fees

**Important**: Only includes items ABOVE the Net Operating Income line (operating expenses only).

## Customization

### Custom Add-Back Patterns

```python
from sde_analyzer import SDEAnalyzer

# Create analyzer
analyzer = SDEAnalyzer('input.xlsx', 'output.xlsx')

# Run detection steps
analyzer.df_cleaned, analyzer.source_sheet_name, analyzer.col_mapping = analyzer.detect_empty_columns()
analyzer.structure = analyzer.identify_structure(analyzer.df_cleaned, analyzer.col_mapping)

# Modify addback patterns before detection
custom_patterns = {
    'custom_category': ['custom expense', 'special item']
}

# Or manually add add-backs
analyzer.addbacks = [
    {'row': 25, 'label': 'Custom Expense', 'category': 'custom'},
    {'row': 30, 'label': 'Another Item', 'category': 'custom'}
]

# Create output
analyzer.create_output()
```

### Custom Styling

The `_apply_styling()` method can be overridden to customize colors, fonts, and layout.

## Error Handling

```python
from sde_analyzer import analyze_sde

try:
    result = analyze_sde('input.xlsx', 'output.xlsx')
    print("Success!")
except FileNotFoundError:
    print("Input file not found")
except ValueError as e:
    print(f"Analysis error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Testing

```python
# Test with sample file
from sde_analyzer import analyze_sde

result = analyze_sde(
    'test_data/sample_pl.xlsx',
    'test_output/sample_sde.xlsx',
    verbose=True
)

assert result['years'] == ['2023', '2024']
assert result['addbacks_count'] > 0
assert os.path.exists(result['output_file'])
```

## Deployment Considerations

### Production Recommendations

1. **File Size Limits**: Set max upload size (e.g., 10MB)
2. **Timeout**: Analysis typically takes < 5 seconds
3. **Temp File Cleanup**: Always clean up temp files (use try/finally)
4. **Error Logging**: Log errors for debugging
5. **Validation**: Verify Excel format before processing

### Example with Validation

```python
def is_valid_excel(file_path: str) -> bool:
    """Validate Excel file"""
    try:
        wb = load_workbook(file_path, data_only=True)
        return len(wb.sheetnames) > 0
    except:
        return False

# Use in API
if not is_valid_excel(input_path):
    return {"error": "Invalid Excel file"}, 400
```

### Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY sde_analyzer.py .
COPY flask_api_example.py .

CMD ["python", "flask_api_example.py"]
```

## Performance

- **Typical file (30 months)**: < 2 seconds
- **Large file (5 years, 200 rows)**: < 5 seconds
- **Memory usage**: ~50-100MB depending on file size

## License

MIT License - Free to use in commercial and personal projects

## Support

This is a standalone package extracted from a Claude.ai skill. For issues or questions:

1. Check that your input file meets the requirements
2. Enable `verbose=True` to see detailed progress
3. Verify pandas and openpyxl are installed correctly

## Version History

- **2.3** - Standalone package with professional styling
- **2.2** - Added professional formatting
- **2.1** - Formula-based calculations
- **2.0** - Empty column detection

## Examples

See the `examples/` directory for:
- Sample input files
- Flask API implementation
- FastAPI implementation
- React frontend integration example
- Error handling patterns
