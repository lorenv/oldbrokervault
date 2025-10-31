# Quick Start Guide

Get up and running with SDE Analyzer in 5 minutes.

## 1. Install Dependencies

```bash
pip install -r requirements.txt
```

## 2. Test Command Line

```bash
# Test with your P&L file
python sde_analyzer.py your_profit_loss.xlsx output_sde.xlsx
```

## 3. Test Python API

Create `test.py`:

```python
from sde_analyzer import analyze_sde

result = analyze_sde('your_profit_loss.xlsx', 'output_sde.xlsx')
print(f"Success! Analyzed {len(result['years'])} years")
```

Run it:
```bash
python test.py
```

## 4. Set Up Web API (Optional)

### Install API dependencies:
```bash
pip install -r requirements-api.txt
```

### Start the Flask server:
```bash
python flask_api_example.py
```

The API will be available at `http://localhost:5000`

### Test with curl:
```bash
curl -X POST \
  -F "file=@your_profit_loss.xlsx" \
  -F "company_name=My Company" \
  http://localhost:5000/analyze-sde \
  --output result.xlsx
```

### Or open the web client:
```bash
# 1. Start the API (in one terminal)
python flask_api_example.py

# 2. Open web_client_example.html in your browser
open web_client_example.html
```

## 5. Deploy to Production

### Option A: Simple Server

```bash
# Install gunicorn
pip install gunicorn

# Run production server
gunicorn -w 4 -b 0.0.0.0:5000 flask_api_example:app
```

### Option B: Docker

Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements-api.txt .
RUN pip install --no-cache-dir -r requirements-api.txt

COPY sde_analyzer.py .
COPY flask_api_example.py .

EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "flask_api_example:app"]
```

Build and run:
```bash
docker build -t sde-analyzer .
docker run -p 5000:5000 sde-analyzer
```

### Option C: Cloud Deployment

**Heroku:**
```bash
# Create Procfile
echo "web: gunicorn flask_api_example:app" > Procfile

# Deploy
git init
git add .
git commit -m "Initial commit"
heroku create your-app-name
git push heroku main
```

**AWS Lambda:** See `lambda_deployment.md` (coming soon)

## Troubleshooting

### "ModuleNotFoundError: No module named 'pandas'"
```bash
pip install -r requirements.txt
```

### "Could not identify revenue or NOI rows"
- Check your Excel file has "Total Income" or "Total Revenue" row
- Check for "Net Income" or "Net Operating Income" row
- Row labels should be in columns A-E

### API returns 500 error
- Check file format is .xlsx or .xls
- Verify file size is under 10MB
- Enable verbose logging in Flask app for details

### Empty columns not detected
- This is normal if your file doesn't have spacing columns
- Analysis will continue without issues

## Next Steps

1. Read `README.md` for comprehensive documentation
2. Check `usage_example.py` for more code examples
3. Customize styling in `sde_analyzer.py` (search for `_apply_styling`)
4. Add custom add-back patterns (search for `addback_patterns`)

## Support

For questions or issues:
1. Check `README.md` documentation
2. Review `usage_example.py` for code patterns
3. Enable `verbose=True` for detailed output

## License

MIT License - Free for commercial and personal use
