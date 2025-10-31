#!/usr/bin/env python3
"""
Simple usage examples for SDE Analyzer
"""

from sde_analyzer import analyze_sde, SDEAnalyzer
import os

# Example 1: Basic Usage
print("="*60)
print("Example 1: Basic Usage")
print("="*60)

# Replace with your actual file path
input_file = "your_profit_loss.xlsx"
output_file = "sde_analysis_output.xlsx"

if os.path.exists(input_file):
    result = analyze_sde(input_file, output_file)
    print(f"✓ Success! Analyzed {len(result['years'])} years")
    print(f"✓ Found {result['addbacks_count']} add-backs")
    print(f"✓ Output: {result['output_file']}")
else:
    print(f"⚠ File not found: {input_file}")


# Example 2: With Company Name
print("\n" + "="*60)
print("Example 2: With Company Name")
print("="*60)

if os.path.exists(input_file):
    result = analyze_sde(
        input_file, 
        "sde_with_company_name.xlsx",
        company_name="Acme Corporation",
        verbose=True  # Show progress
    )


# Example 3: Object-Oriented API
print("\n" + "="*60)
print("Example 3: Object-Oriented API")
print("="*60)

if os.path.exists(input_file):
    # Create analyzer
    analyzer = SDEAnalyzer(
        input_file=input_file,
        output_file="sde_oo_example.xlsx",
        company_name="Tech Startup Inc"
    )
    
    # Run analysis
    result = analyzer.analyze(verbose=False)
    
    # Access internal details
    print(f"\nDetailed Results:")
    print(f"  Company: {analyzer.company_name}")
    print(f"  Source Sheet: {analyzer.source_sheet_name}")
    print(f"  Years Detected: {sorted(analyzer.structure['month_cols_by_year'].keys())}")
    
    if analyzer.addbacks:
        print(f"\n  Add-backs Found:")
        for ab in analyzer.addbacks:
            print(f"    - {ab['label']} ({ab['category']})")


# Example 4: Error Handling
print("\n" + "="*60)
print("Example 4: Error Handling")
print("="*60)

try:
    result = analyze_sde(
        "nonexistent_file.xlsx",
        "output.xlsx",
        verbose=False
    )
except FileNotFoundError:
    print("✓ Properly caught missing file error")
except Exception as e:
    print(f"✗ Unexpected error: {e}")


# Example 5: Batch Processing
print("\n" + "="*60)
print("Example 5: Batch Processing")
print("="*60)

input_files = [
    "company_a_pl.xlsx",
    "company_b_pl.xlsx",
    "company_c_pl.xlsx"
]

for input_file in input_files:
    if os.path.exists(input_file):
        output_file = input_file.replace('.xlsx', '_SDE.xlsx')
        try:
            result = analyze_sde(input_file, output_file, verbose=False)
            print(f"✓ Processed: {input_file}")
        except Exception as e:
            print(f"✗ Failed: {input_file} - {e}")
    else:
        print(f"⚠ Skipped: {input_file} (not found)")


print("\n" + "="*60)
print("Examples Complete!")
print("="*60)
print("\nTo use with your own files:")
print("1. Replace 'your_profit_loss.xlsx' with your actual file path")
print("2. Run: python usage_example.py")
