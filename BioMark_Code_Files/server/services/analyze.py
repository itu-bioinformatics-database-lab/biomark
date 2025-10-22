# analyze.py

import debugpy, logging
import os # os module will also be used for logging

# Logging settings
log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'logs'))
os.makedirs(log_dir, exist_ok=True)
log_file_path = os.path.join(log_dir, 'analyze.log')
logging.basicConfig(filename=log_file_path, level=logging.INFO, format='%(asctime)s - %(message)s')

#logging.info("This is a test message.")
"""
debugpy.listen(("localhost", 5678))
logging.info("Python debugger is waiting for connection...")

debugpy.wait_for_client()
logging.info("Debugger attached.")"""

# Import required packages
import os, sys, json, argparse
import pandas as pd
import numpy as np
from tqdm.notebook import tqdm
import seaborn as sns
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

# Add ../modules directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from modules.machineLearning.classification import Classification
from modules.differentialAnalysis.differential_analysis import DifferentiatingFactorAnalysis
from modules.dataVisualization.dimensionality_reduction import Dimensionality_Reduction
from modules.differentialAnalysis.feature_selection import feature_rank
from modules.utils import load_json
from modules.utils import load_table

# General Parameters

# Differential Analysis Parameters
feature_type = "microRNA"      # Feature type to analyze, used for diff analysis - for plot labels
reference_class = ""           # Reference class (currently unused)
lime_global_explanation_sample_num = 50  # Number of samples for LIME global explanations, diff analysis
shap_model_finetune = False    # Model fine-tuning for SHAP explainability analysis
lime_model_finetune = False    # Model fine-tuning for LIME explainability analysis
scoring = "f1"                 # Model evaluation metric, diff analysis
feature_importance_finetune = False  # Model fine-tuning for feature importance analysis
num_top_features = 20          # Number of top features to use in feature selection, diff analysis

# Clustering Analysis Parameters
plotter = "seaborn"            # Visualization library selection, diff analysis
dim = "3D"

# Classification Analysis Parameters
param_finetune = False         # For model hyperparameter optimization
finetune_fraction = 1.0        # Fraction of data to use for fine-tuning
save_best_model = True         # Whether to save the best performing model
standard_scaling = True        # Whether to apply standard scaling for data normalization
save_data_transformer = True   # Whether to save the data transformation model
save_label_encoder = True      # Whether to save the label encoder
verbose = True                 # Show detailed output during analysis

# Differential Analysis and Classification Analysis Parameters
test_size = 0.2                # Test set ratio for model training (0.2 for model and diff analysis, 0.3 for clustering)
n_folds = 5                    # Number of cross-validation folds (5 for model and diff analysis, 3 for clustering)


# Data loading function
def load_data(data_path, outdir):
    os.makedirs(outdir, exist_ok=True)
    df = pd.read_csv(data_path)
    return df

# Differential analysis function
def run_differential_analysis(data, selectedIllnessColumn, selectedSampleColumn, outdir, analyses):
    print("analyses: ", analyses)
    print("type(analyses): ", type(analyses))
    print("selectedIllnessColumn: ", selectedIllnessColumn)
    print("type(selectedIllnessColumn): ", type(selectedIllnessColumn))
    
    # Data validation: check if selectedIllnessColumn and selectedSampleColumn exist
    if selectedIllnessColumn not in data.columns:
        print(f"ERROR: Column '{selectedIllnessColumn}' not found in dataset!")
        return
        
    if selectedSampleColumn not in data.columns:
        print(f"ERROR: Column '{selectedSampleColumn}' not found in dataset!")
        return
    
    # Class_names check: at least 2 unique classes in the dataframe?
    # Ensure illness labels are strings (user may upload numeric codes). Convert and strip whitespace.
    try:
        data[selectedIllnessColumn] = data[selectedIllnessColumn].astype(str).str.strip()
    except Exception:
        # Fallback: coerce via pandas to avoid unexpected errors
        data[selectedIllnessColumn] = data[selectedIllnessColumn].apply(lambda x: '' if pd.isna(x) else str(x).strip())
        
    # show python-level types frequency for values
    try:
        type_counts = data[selectedIllnessColumn].map(type).value_counts().to_dict()
        print(f"Value types in column: {type_counts}")
    except Exception as _:
        pass

    unique_classes = data[selectedIllnessColumn].unique()
    print("Unique classes found:", unique_classes)
    
    if len(unique_classes) < 2:
        print(f"At least 2 classes are required, but only {len(unique_classes)} found. Analysis cannot proceed.")
        return
        
    # Check for missing values in class column
    if data[selectedIllnessColumn].isna().any():
        print(f"WARNING: Missing (NA/None) values found in column '{selectedIllnessColumn}'.")
        # Optionally filter out rows with missing values
        data = data.dropna(subset=[selectedIllnessColumn])
        print(f"Missing values filtered. New data shape: {data.shape}")
        
    # Process analyses parameter
    if isinstance(analyses, str):
        # If string and contains comma, split
        if ',' in analyses:
            analyses_list = analyses.split(',')
        else:
            analyses_list = [analyses]
    else:
        # If list or other type, use as is
        analyses_list = analyses
        
    # Clean: remove empty strings and whitespace
    analyses_list = [a.strip() for a in analyses_list if a and a.strip()]
    
    if not analyses_list:
        print("ERROR: No valid analysis specified!")
        return
        
    print("analyses_list:", analyses_list)
    
    try:
        analyzer = DifferentiatingFactorAnalysis(
            data,
            analyses=analyses_list,
            labels_column=selectedIllnessColumn,
            reference_class=reference_class,
            sample_id_column=selectedSampleColumn,
            outdir=outdir,
            mode="classification",
            feature_type=feature_type,
            test_size=test_size,
            lime_global_explanation_sample_num=lime_global_explanation_sample_num,
            shap_model_finetune = shap_model_finetune,
            lime_model_finetune = lime_model_finetune,
            n_folds = n_folds,
            scoring = scoring,
            top_features_to_plot=num_top_features
        )
        analyzer.run_all_analyses()
    except Exception as e:
        import traceback
        print(f"ERROR: Exception occurred while running DifferentiatingFactorAnalysis: {str(e)}")
        traceback.print_exc()

# Pre-visualization function
def initial_visualization(data, visualizations, outdir, selectedSampleColumn, selectedIllnessColumn):
    print("visualizations: ", visualizations)
    if visualizations and visualizations != ['']:
        dim_visualizer = Dimensionality_Reduction(data=data.drop(columns=selectedSampleColumn),
                                                labels_column=selectedIllnessColumn,
                                                plotter=plotter,
                                                outdir=os.path.join(outdir, "initial"))
        dim_visualizer.runPlots(runs=visualizations)

# Pre-model training function
def initial_model_training(data, selectedIllnessColumn, selectedSampleColumn, outdir, model_list):
    print("model_list: ", model_list)
    if model_list and model_list != ['']:
        clf = Classification(
            data=data.drop(columns=selectedSampleColumn),
            labels_column=selectedIllnessColumn,
            n_folds=n_folds,
            test_size=test_size,
            outdir=os.path.join(outdir, "initial"),
            param_finetune=param_finetune,
            finetune_fraction = finetune_fraction,
            save_best_model = save_best_model,
            standard_scaling = standard_scaling,
            save_data_transformer = save_data_transformer,
            save_label_encoder = save_label_encoder,            
            model_list=model_list,
            verbose=verbose
        )
        clf.data_transfrom()
        clf.initiate_model_trainer()

# Feature selection function (class-pair aware)
def feature_selection(outdir, class_pair: str):
    """Return top ranked features for the given class pair if available.

    Parameters
    ----------
    outdir : str
        Directory that contains ``feature_importances.json``.
    class_pair : str
        Target class pair key in the form "ClassA_ClassB" (case-sensitive, depends on previous save).

    Returns
    -------
    list | None
        List of top ``num_top_features`` features for the given class pair or ``None``
        if the class pair does not exist in the file.
    """

    # Load saved feature importances
    feature_importances_path = os.path.join(outdir, "feature_importances.json")
    feature_importances = load_json(feature_importances_path)

    if not feature_importances or not isinstance(feature_importances, dict):
        return None

    # Try both possible key orders (e.g. A_B and B_A)
    possible_keys = [class_pair]
    if "_" in class_pair:
        cls1, cls2 = class_pair.split("_", 1)
        possible_keys.append(f"{cls2}_{cls1}")

    selected_key = next((k for k in possible_keys if k in feature_importances), None)
    if not selected_key:
        # No differential analysis for this class pair
        return None

    # Use only the selected class pair data for ranking
    filtered_importances = {selected_key: feature_importances[selected_key]}

    top_n = feature_rank(top_features=filtered_importances,
                         num_top_features=num_top_features,
                         feature_type=feature_type,
                         outdir=outdir)

    return top_n

# Post-feature selection visualization function
def visualization_after_feature_selection(data, visualizations, outdir, selectedIllnessColumn):
    if(visualizations != ['']):
        dim_visualizer = Dimensionality_Reduction(data,
                                                labels_column=selectedIllnessColumn,
                                                plotter=plotter,
                                                outdir=os.path.join(outdir, "AfterFeatureSelection"))
        dim_visualizer.runPlots(runs=visualizations)

# Post-feature selection model training function
def model_training_after_feature_selection(data, selectedIllnessColumn, outdir):
    if classificationAnalyzes != ['']:
        clf = Classification(
            data=data,
            labels_column=selectedIllnessColumn,
            n_folds=n_folds,
            test_size=test_size,
            outdir=os.path.join(outdir, "AfterFeatureSelection"),
            param_finetune=param_finetune,
            finetune_fraction = finetune_fraction,
            save_best_model = save_best_model,
            standard_scaling = standard_scaling,
            save_data_transformer = save_data_transformer,
            save_label_encoder = save_label_encoder,
            model_list=model_list,
            verbose=verbose
        )
        clf.data_transfrom()
        clf.initiate_model_trainer()

# Main script execution
if __name__ == "__main__":
    # Set up command line arguments
    parser = argparse.ArgumentParser(description='Parameters for biomarker analysis')
    parser.add_argument('data_path', help='Path to the data file')
    parser.add_argument('selectedIllnessColumn', help='Name of the illness column')
    parser.add_argument('selectedSampleColumn', help='Name of the sample column')
    parser.add_argument('selectedClasseses', help='Selected classes')
    parser.add_argument('differentialAnalyzes', help='Differential analysis methods')
    parser.add_argument('clusteringAnalyzes', help='Clustering analysis methods')
    parser.add_argument('classificationAnalyzes', help='Classification analysis methods')
    parser.add_argument('nonFeatureColumns', help='Non-feature columns')
    parser.add_argument('isDiffAnalysis', help='Whether to perform differential analysis')
    parser.add_argument('afterFeatureSelection', help='Whether to perform analysis after feature selection')
    parser.add_argument('--params', help='Parameter settings (in JSON format)', default='{}')

    args = parser.parse_args()
    
    # Extract arguments
    data_path = args.data_path
    selectedIllnessColumn = args.selectedIllnessColumn
    selectedSampleColumn = args.selectedSampleColumn
    selectedClasseses = [cls for cls in args.selectedClasseses.split(',')] if args.selectedClasseses else []
    print("selectedClasseses: ", selectedClasseses)
    print("type(selectedClasseses): ", type(selectedClasseses))
    differentialAnalyzes = args.differentialAnalyzes.lower().replace('-', '_') if args.differentialAnalyzes else ''    
    # Load parameter settings in JSON format
    params_json = {}
    if args.params and args.params != '{}':
        try:
            params_json = json.loads(args.params)
            
            # First check and update dim parameter
            if "dim" in params_json:
                globals()["dim"] = params_json["dim"]
                print(f"dim parameter updated: {dim}")
        except Exception as e:
            print(f"Error parsing parameter JSON: {e}")
    
    # Add dim variable to clusteringAnalyzes argument (e.g., 2d_ or 3d_)
    if args.clusteringAnalyzes:
        dim_prefix = dim.lower() + "_" if dim else ""  # Convert dim to lowercase and add _
        clusteringAnalyzes = dim_prefix + args.clusteringAnalyzes.lower()
    else:
        clusteringAnalyzes = ''
    
    # Update other parameters
    if params_json:
        try:
            # Update Differential Analysis Parameters
            if "feature_type" in params_json:
                globals()["feature_type"] = params_json["feature_type"]
            if "reference_class" in params_json:
                globals()["reference_class"] = params_json["reference_class"]
            if "lime_global_explanation_sample_num" in params_json:
                globals()["lime_global_explanation_sample_num"] = params_json["lime_global_explanation_sample_num"]
            if "shap_model_finetune" in params_json:
                globals()["shap_model_finetune"] = params_json["shap_model_finetune"]
            if "lime_model_finetune" in params_json:
                globals()["lime_model_finetune"] = params_json["lime_model_finetune"]
            if "scoring" in params_json:
                globals()["scoring"] = params_json["scoring"]
            if "feature_importance_finetune" in params_json:
                globals()["feature_importance_finetune"] = params_json["feature_importance_finetune"]
            if "num_top_features" in params_json:
                globals()["num_top_features"] = params_json["num_top_features"]
            
            # Update Clustering Analysis Parameters
            if "plotter" in params_json:
                globals()["plotter"] = params_json["plotter"]
            # (dim parameter updated above)
            
            # Update Classification Analysis Parameters
            if "param_finetune" in params_json:
                globals()["param_finetune"] = params_json["param_finetune"]
            if "finetune_fraction" in params_json:
                globals()["finetune_fraction"] = params_json["finetune_fraction"]
            if "save_best_model" in params_json:
                globals()["save_best_model"] = params_json["save_best_model"]
            if "standard_scaling" in params_json:
                globals()["standard_scaling"] = params_json["standard_scaling"]
            if "save_data_transformer" in params_json:
                globals()["save_data_transformer"] = params_json["save_data_transformer"]
            if "save_label_encoder" in params_json:
                globals()["save_label_encoder"] = params_json["save_label_encoder"]
            if "verbose" in params_json:
                globals()["verbose"] = params_json["verbose"]
            
            # Update Common Parameters
            if "test_size" in params_json:
                globals()["test_size"] = params_json["test_size"]
            if "n_folds" in params_json:
                globals()["n_folds"] = params_json["n_folds"]
                
        except Exception as e:
            print(f"Error loading parameter settings: {e}")
    
    classificationAnalyzes = args.classificationAnalyzes if args.classificationAnalyzes else ''
    
    # Keep nonFeatureColumns as a normal string, will convert to uppercase during dataframe processing
    nonFeatureColumns = args.nonFeatureColumns.split(',') if args.nonFeatureColumns else []
    
    isDiffAnalysis = [item.lower() for item in args.isDiffAnalysis.split(',')] if args.isDiffAnalysis else []
    afterFeatureSelection = args.afterFeatureSelection.lower() == 'true' if args.afterFeatureSelection else False

    differentialAnalyzes = [item.strip() for item in differentialAnalyzes.split(",")]
    classificationAnalyzes = [item.strip() for item in classificationAnalyzes.split(",")]
    clusteringAnalyzes = [item.strip() for item in clusteringAnalyzes.split(",")]

    # Print parameters
    print("Data Path:", data_path)
    print("Selected Illness Column:", selectedIllnessColumn)
    print("Selected Sample Column:", selectedSampleColumn)
    print("Selected Classes:", selectedClasseses)
    print("Differential Analyzes:", differentialAnalyzes)
    print("Clustering Analyzes:", clusteringAnalyzes)
    print("Classification Analyzes:", classificationAnalyzes)
    print("Non-Feature Columns:", nonFeatureColumns)
    print("Is Differential Analysis:", isDiffAnalysis)
    print("After Feature Selection:", afterFeatureSelection)
    
    # Print parameter settings
    print("\nParameter Settings:")
    print(f"feature_type: {feature_type}")
    print(f"lime_global_explanation_sample_num: {lime_global_explanation_sample_num}")
    print(f"shap_model_finetune: {shap_model_finetune}")
    print(f"lime_model_finetune: {lime_model_finetune}")
    print(f"scoring: {scoring}")
    print(f"feature_importance_finetune: {feature_importance_finetune}")
    print(f"num_top_features: {num_top_features}")
    print(f"plotter: {plotter}")
    print(f"dim: {dim}")
    print(f"param_finetune: {param_finetune}")
    print(f"finetune_fraction: {finetune_fraction}")
    print(f"save_best_model: {save_best_model}")
    print(f"standard_scaling: {standard_scaling}")
    print(f"save_data_transformer: {save_data_transformer}")
    print(f"save_label_encoder: {save_label_encoder}")
    print(f"verbose: {verbose}")
    print(f"test_size: {test_size}")
    print(f"n_folds: {n_folds}")

    # Set analyses parameters
    analyses = differentialAnalyzes
    model_list = classificationAnalyzes
    visualizations = clusteringAnalyzes

    # Output directory
    base_name = os.path.basename(data_path)
    file_name_without_ext = os.path.splitext(base_name)[0]
    outdir = os.path.join("results", file_name_without_ext)

    # Load data
    df = load_table(data_path)

    # Normalize selected classes to strings (strip whitespace)
    selected_classes_norm = [str(x).strip() for x in selectedClasseses]

    # Debug: show original DataFrame info
    print(f"Original df shape before filtering: {df.shape}")
    try:
        print(f"Sample unique values in column '{selectedIllnessColumn}':", pd.Series(df[selectedIllnessColumn].dropna().astype(str).str.strip().unique()[:50]))
    except Exception:
        pass

    # Filter data for selected classes — handle multiple cell formats:
    #  - plain values (numeric or string)
    #  - list-like strings ("['1','2']")
    #  - delimited strings ("1;2" or "1,2")
    import ast

    # Precompute numeric representations of targets when possible for numeric comparison
    numeric_targets = {}
    for t in selected_classes_norm:
        try:
            numeric_targets[t] = float(t)
        except Exception:
            numeric_targets[t] = None

    def numeric_equal(a_str, t_str):
        # compare strings a_str and t_str numerically when possible
        try:
            a_float = float(a_str)
            t_float = numeric_targets.get(t_str)
            if t_float is None:
                try:
                    t_float = float(t_str)
                except Exception:
                    return False
            return a_float == t_float
        except Exception:
            return False

    def cell_matches(cell_val, targets):
        # Return True if cell_val (various formats) contains any of targets
        if pd.isna(cell_val):
            return False
        s = str(cell_val).strip()
        # try to parse python literal lists/tuples
        if s.startswith('[') and s.endswith(']'):
            try:
                parsed = ast.literal_eval(s)
                if isinstance(parsed, (list, tuple, set)):
                    for item in parsed:
                        item_s = str(item).strip()
                        if item_s in targets:
                            return True
                        # numeric compare
                        for t in targets:
                            if numeric_equal(item_s, t):
                                return True
            except Exception:
                pass
        # check common delimiters
        for delim in [',', ';', '|', '/']:
            if delim in s:
                parts = [p.strip() for p in s.split(delim) if p.strip()]
                for p in parts:
                    if p in targets:
                        return True
                    for t in targets:
                        if numeric_equal(p, t):
                            return True
        # fallback to direct match or numeric equality
        if s in targets:
            return True
        for t in targets:
            if numeric_equal(s, t):
                return True
        return False

    print(f"Filtering by selected classes (stringified): {selected_classes_norm}")
    mask = df[selectedIllnessColumn].apply(lambda v: cell_matches(v, selected_classes_norm))
    print(f"Rows matching selected classes: {mask.sum()} / {len(mask)}")
    df = df[mask]

    """ Data Preparation for Analysis """
    # Check column names and find matching columns
    valid_columns = []
    for col in nonFeatureColumns:
        # Convert to uppercase and check
        upper_col = col.upper()
        # Check for exact match
        if upper_col in df.columns:
            valid_columns.append(upper_col)
        else:
            # Case-insensitive match
            for df_col in df.columns:
                if upper_col == df_col.upper():
                    valid_columns.append(df_col)
                    break
    
    # Drop matching columns from dataframe
    data = df.drop(columns=valid_columns).reset_index(drop=True)
    # Ensure feature dtypes are acceptable for XGBoost: int/float/bool/category
    obj_cols = data.select_dtypes(include=['object']).columns.tolist()
    if obj_cols:
        print(f"Converting object-typed feature columns: {obj_cols}")
        for col in obj_cols:
            # skip the label column if present (shouldn't be in data here)
            if col == selectedIllnessColumn or col == selectedSampleColumn:
                continue
            # try numeric conversion
            coerced = pd.to_numeric(data[col], errors='coerce')
            if coerced.notna().sum() > 0 and coerced.isna().sum() < len(coerced):
                # If a reasonable number converted, use numeric with median imputation for NaNs
                med = coerced.median()
                data[col] = coerced.fillna(med)
                print(f"Column {col}: converted to numeric with median imputation (median={med})")
            else:
                # fallback: convert to categorical then use integer codes so XGBoost gets numeric dtype
                s = data[col].astype('category')
                try:
                    mode_val = s.mode(dropna=True).iloc[0]
                    s = s.fillna(mode_val)
                except Exception:
                    # if no mode, fill with empty string category
                    s = s.fillna('')
                codes = s.cat.codes
                data[col] = codes
                print(f"Column {col}: converted to categorical codes (int) with {len(s.cat.categories)} categories")
    
    # Run differential analysis
    if analyses and analyses != ['']:
        print("\nrun_differential_analysis function.....\n")
        run_differential_analysis(data, selectedIllnessColumn, selectedSampleColumn, outdir, analyses)
    
    # Initial visualization
    if visualizations and visualizations != ['']:
        print("initial_visualization function.....\n")
        initial_visualization(data, visualizations, outdir, selectedSampleColumn, selectedIllnessColumn)
    
    # Initial model training
    if model_list and model_list != ['']:
        print("initial_model_training function.....\n")
        initial_model_training(data, selectedIllnessColumn, selectedSampleColumn, outdir, model_list)

# -------------------------------------------------------------------------
#  AFTER FEATURE SELECTION WORKFLOW (only if diff. analysis for this pair)
# -------------------------------------------------------------------------

    # Determine if differential analysis results exist for the current class pair
    class_pair_key = f"{selectedClasseses[0]}_{selectedClasseses[1]}" if len(selectedClasseses) >= 2 else ""

    top_n = None
    feature_importances_file_path = os.path.join(outdir, "feature_importances.json")
    if os.path.exists(feature_importances_file_path) and class_pair_key:
        print("feature_selection function.....\n")
        top_n = feature_selection(outdir, class_pair_key)

    if top_n:
        # Use only the selected top features
        data_fs = data[[selectedIllnessColumn] + top_n]

        # Post-feature selection visualization
        if visualizations and visualizations != ['']:
            print("visualization_after_feature_selection function.....\n")
            visualization_after_feature_selection(data_fs, visualizations, outdir, selectedIllnessColumn)

        # Post-feature selection model training
        if model_list and model_list != ['']:
            print("model_training_after_feature_selection function.....\n")
            model_training_after_feature_selection(data_fs, selectedIllnessColumn, outdir)
    
    exit()