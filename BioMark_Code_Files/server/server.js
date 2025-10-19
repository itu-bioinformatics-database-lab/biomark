const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db/database');
const sessionMiddleware = require('./middleware/session');

const { spawn } = require('child_process');

const app = express();

app.get('/', (req, res) => {
  res.send('Biomarker API server is running.');
});

app.use(cors({
    origin: 'http://localhost:3000',
    exposedHeaders: ['x-session-id'] // Allow client to read the session header
}));
app.use(sessionMiddleware);
app.use(express.json()); // Middleware to parse JSON request bodies

// Helper function to get the correct python command depending on the OS
const getPythonCommand = () => {
    return process.platform === 'win32' ? 'python' : 'python3';
};

// Multer settings for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join('uploads'); // Platform-independent uploads path
        // Create the folder if it does not exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Always prefix with a UUID to guarantee uniqueness across users and uploads
        const uploadId = uuidv4();
        req.uploadId = uploadId; // expose to route handler
        const newFileName = `${uploadId}_${file.originalname}`;
        cb(null, newFileName);
    }
});

// File filter to allow only certain file types
const fileFilter = (req, file, cb) => {
    const allowedTypes = /png|jpg|jpeg|csv|gz/; // Allowing .gz files along with images
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only images and .gz files are allowed!'));
    }
};

const upload = multer({ 
    storage: storage,
    //fileFilter: fileFilter // Uncomment to apply the file filter
});

// Helper function to format elapsed time in a human-readable way
function formatElapsedTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
  
    if (hours > 0) {
        return `${hours} hours ${minutes} mins ${seconds} secs`;
    } else if (minutes > 0) {
        return `${minutes} mins ${seconds} secs`;
    } else {
        return `${seconds} secs`;
    }
  }

// step1 - Endpoint for demo data (session-safe)
app.get('/get-demo-data', (req, res) => {
  console.log('Demo data endpoint called');

  // Path of immutable demo file shipped with the project
  const originalDemoPath = path.join(__dirname, 'uploads', 'GSE120584_serum_norm_demo.csv');
  if (!fs.existsSync(originalDemoPath)) {
    return res.status(404).json({ success: false, error: 'Demo file missing on server' });
  }

  // Create a unique copy so each session gets its own workspace
  const uploadId = uuidv4();
  const copiedName = `${uploadId}_GSE120584_serum_norm_demo.csv`;
  const serverRelativePath = path.join('uploads', copiedName);
  const demoFilePath = path.join(__dirname, serverRelativePath);

  try {
    fs.copyFileSync(originalDemoPath, demoFilePath);
  } catch (copyErr) {
    console.error('Failed to copy demo file:', copyErr);
    return res.status(500).json({ success: false, error: 'Failed to prepare demo file' });
  }

  // Save metadata just like a normal upload
  try {
    db.prepare('INSERT INTO uploads (id, session_id, original_name, server_path) VALUES (?,?,?,?)')
      .run(uploadId, req.sessionId, 'GSE120584_serum_norm_demo.csv', demoFilePath);
  } catch (dbErr) {
    console.error('DB insert failed for demo upload:', dbErr);
  }

  // Obtain first columns via existing Python helper
  const python = spawn(getPythonCommand(), [
    '-Xfrozen_modules=off',
    path.join(__dirname, 'services', 'upload.py'),
    demoFilePath
  ]);

  let stdout = '', stderr = '';
  python.stdout.on('data', (d) => { stdout += d.toString(); });
  python.stderr.on('data', (d) => {
    console.error(`stderr: ${d}`);
    stderr += d.toString();
  });

  python.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ success: false, error: 'Python process failed', details: stderr });
    }

    try {
      const parsed = JSON.parse(stdout.trim());
      const columns = Array.isArray(parsed) ? parsed.slice(0, 10).map((c) => c.trim()) : [];
      const fileSizeBytes = fs.statSync(demoFilePath).size;
      return res.json({
        success: true,
        columns,
        filePath: demoFilePath,
        uploadId,
        fileSize: fileSizeBytes,
        message: 'Demo data loaded successfully'
      });
    } catch (parseErr) {
      console.error('Failed to parse Python output:', parseErr);
      return res.status(500).json({ success: false, error: 'Failed to parse column names' });
    }
  });
});

// step1 - Endpoint to download the demo file
app.get('/download-demo-file', (req, res) => {
    const demoFilePath = path.join(__dirname, 'uploads', 'GSE120584_serum_norm_demo.csv');
    
    // Check if the demo file exists
    if (fs.existsSync(demoFilePath)) {
        // Send the file for download
        res.download(demoFilePath, 'GSE120584_serum_norm_demo.csv', (err) => {
            if (err) {
                console.error('Error downloading demo file:', err);
                res.status(500).send('Error downloading demo file');
            }
        });
    } else {
        // Return error if the demo file does not exist
        res.status(404).send('Demo file not found');
    }
});

// step2 - Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    console.log("At upload endpoint.");
    const filePath = req.file.path;
    const uploadId = req.uploadId;

    // Persist upload metadata
    try {
        db.prepare('INSERT INTO uploads (id, session_id, original_name, server_path) VALUES (?,?,?,?)')
          .run(uploadId, req.sessionId, req.file.originalname, filePath);
    } catch (err) {
        console.error('Failed to insert upload record:', err);
    }

    // Get the parameter (columns) from the request
    const columnCount = req.body.columns || 'all'; // Default is 'all'

    // Call the Python script
    const pythonCommand = getPythonCommand();
    const scriptPath = path.join(__dirname, 'services', 'upload.py');
    const python = spawn(pythonCommand, ['-Xfrozen_modules=off', scriptPath, filePath]);
    let outputData = [];
    let errorOutput = '';

    python.stdout.on('data', (data) => {
        outputData.push(data.toString());
    });

    python.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        errorOutput += data.toString();
    });

    python.on('close', (code) => {
        try {
            if (code === 0) {
                // Combine all chunks and parse as JSON
                const combinedOutput = outputData.join('').trim();
                
                console.log("--- Raw output from Python script (upload.py for /upload) ---");
                console.log(combinedOutput);
                console.log("--- End of raw output ---");

                const parsedOutput = JSON.parse(combinedOutput);

                if (Array.isArray(parsedOutput)) {
                    // Filter columns by column count
                    let filteredColumns = parsedOutput.map((col) => col.trim());
                    if (columnCount !== 'all' && !isNaN(columnCount)) {
                        filteredColumns = filteredColumns.slice(0, parseInt(columnCount));
                    }

                    res.json({
                        success: true,
                        columns: filteredColumns,
                        filePath: req.file.path,
                        uploadId: uploadId
                    });
                } else {
                    throw new Error('Parsed output is not an array');
                }
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Python process failed'
                });
            }
        } catch (error) {
            console.error('Error parsing column names:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to parse column names'
            });
        }
    });
});

// step2 - Merge files endpoint
app.post('/merge-files', async (req, res) => {
    const { chosenColumns } = req.body;

    if (!chosenColumns || !Array.isArray(chosenColumns) || chosenColumns.length < 2) {
        return res.status(400).json({ success: false, error: 'Provide at least two files.' });
    }

    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.join(__dirname, 'services', 'merge.py');

    // Send chosenColumns as a single JSON argument
    const pythonArgs = [
        '-Xfrozen_modules=off',
        scriptPath,
        JSON.stringify(chosenColumns)
    ];

    console.log("Running Python command:", pythonCommand, pythonArgs.join(" "));

    const python = spawn(pythonCommand, pythonArgs);
    let stdout = '', stderr = '';

    python.stdout.on('data', data => stdout += data.toString());
    python.stderr.on('data', data => stderr += data.toString());

    python.on('close', code => {
        if (code === 0) {
            try {
                const parsed = JSON.parse(stdout.trim());
                return res.json({
                    success: true,
                    mergedFilePath: parsed.mergedFilePath,
                    metadataPath: parsed.metadataPath,
                    columns: parsed.columns
                });
            } catch (err) {
                console.error(err);
                return res.status(500).json({ success: false, error: 'Failed to parse merged file info' });
            }
        } else {
            console.error(stderr);
            return res.status(500).json({ success: false, error: 'Merge failed', details: stderr });
        }
    });
});



// step3 - Get all columns
app.post('/get_all_columns', (req, res) => {
    console.log("At get all columns endpoint.");
    const { filePath } = req.body;
    console.log("filePath: ", filePath);

    const pythonCommand = getPythonCommand();
    const scriptPath = path.join(__dirname, 'services', 'get_all_columns.py');
    const python = spawn(pythonCommand, ['-Xfrozen_modules=off', scriptPath, filePath]);
    let outputData = [];

    python.stdout.on('data', (data) => {
        const output = data.toString().trim().split('\n');
        outputData = outputData.concat(output.map(col => col.trim()));
    });

    python.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    python.on('close', (code) => {
        if (code === 0) {
            res.json({
                success: true,
                columns: outputData
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Python process failed'
            });
        }
    });
});

// step3 - Get the classes of the selected column
app.post('/get_classes', (req, res) => { 
    console.log("At get classes endpoint.")
    const {filePath, columnName} = req.body; // Get the file path and column name from the request body
    console.log("filePath: ", filePath);
    console.log("columnName: ", columnName);
    const pythonCommand = getPythonCommand();
    const scriptPath = path.join(__dirname, 'services', 'get_classes.py');
    const python = spawn(pythonCommand, ['-Xfrozen_modules=off', scriptPath, filePath, columnName]);
    let outputData = []; // Array to hold the output data

    python.stdout.on('data', (data) => {
        const output = data.toString().trim().split('\n'); // Split the output into lines
        outputData = outputData.concat(output.map(path => path.trim())); // Add the output to the array
    });

    python.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    python.on('close', (code) => {
        if (code === 0) {
            // Return the response with imagePaths and success fields
            res.json({
                success: true, 
                classList_: outputData
            });
        } else {
            // Send an error message in case of a Python process failure
            res.status(500).json({ 
                success: false,
                error: 'Python process failed' 
            });
        }
    });
});

// step7 - Run the analysis
app.post('/analyze', (req, res) => {
    
    console.log("At analyze endpoint.")
    console.log("Request body: ", req.body);
    
    // Assign the values from req.body to the variables on the left
    const {
        filePath, 
        IlnessColumnName, 
        SampleColumnName, 
        selectedClasses, 
        differential, 
        clustering, 
        classification, 
        nonFeatureColumns, 
        isDiffAnalysis, 
        afterFeatureSelection,
        // Parameter information
        useDefaultParams,
        featureType,
        referenceClass,
        limeGlobalExplanationSampleNum,
        shapModelFinetune,
        limeModelFinetune,
        scoring,
        featureImportanceFinetune,
        numTopFeatures,
        plotter,
        dim,
        paramFinetune,
        finetuneFraction,
        saveBestModel,
        standardScaling,
        saveDataTransformer,
        saveLabelEncoder,
        verbose,
        testSize,
        nFolds
    } = req.body;

    // Normalize file path for cross-platform consistency
    const normalizedFilePath = path.normalize(filePath);

    // Check if it's a merged file (system-generated)
    const isMergedFile = normalizedFilePath.includes(path.join('results', 'merged_files'));

    // Ownership check — only apply to user uploads
    if (!isMergedFile) {
        const derivedUploadId = path.basename(filePath).split('_')[0];
        const uploadOwner = db.prepare('SELECT session_id FROM uploads WHERE id = ?').get(derivedUploadId);

        if (!uploadOwner || uploadOwner.session_id !== req.sessionId) {
            return res.status(403).json({ success: false, error: 'Access denied for this file' });
        }
    }

    const analysisId = uuidv4();
    let derivedUploadIdForInsert = null;

    if (!isMergedFile) {
        derivedUploadIdForInsert = path.basename(filePath).split('_')[0];
    }

    // Record analysis start
    try {
        db.prepare('INSERT INTO analyses (id, upload_id, status) VALUES (?,?,?)')
        .run(analysisId, derivedUploadIdForInsert, 'running');
    } catch (err) {
        console.error('Failed to insert analysis record:', err);
    }

    
    const startTime = Date.now(); // Start time of the process
    console.log(filePath, IlnessColumnName, SampleColumnName, selectedClasses, differential, clustering, classification, nonFeatureColumns, isDiffAnalysis);
    
    // Fix undefined values
    const safeIsDiffAnalysis = isDiffAnalysis || differential || [];
    const safeAfterFeatureSelection = afterFeatureSelection === undefined ? false : afterFeatureSelection;
    
    // Prepare Python command and parameters
    const pythonArgs = [
        '-Xfrozen_modules=off', 
        path.join(__dirname, 'services', 'analyze.py'), 
        filePath, 
        IlnessColumnName, 
        SampleColumnName, 
        Array.isArray(selectedClasses) ? selectedClasses : [], 
        Array.isArray(differential) && differential.length > 0 ? differential.join(',') : '', 
        Array.isArray(clustering) && clustering.length > 0 ? clustering.join(',') : '', 
        Array.isArray(classification) && classification.length > 0 ? classification.join(',') : '', 
        Array.isArray(nonFeatureColumns) ? nonFeatureColumns : [], 
        Array.isArray(safeIsDiffAnalysis) ? safeIsDiffAnalysis.join(',') : '', // Differential analyses
        String(safeAfterFeatureSelection) // After feature selection status
    ];
    
    // If not using default parameters, add --params argument and parameters
    if (!useDefaultParams) {
        pythonArgs.push('--params');
        pythonArgs.push(JSON.stringify({
            // Differential Analysis Parameters
            feature_type: featureType || "microRNA",
            reference_class: referenceClass || "",
            lime_global_explanation_sample_num: limeGlobalExplanationSampleNum || 50,
            shap_model_finetune: !!shapModelFinetune, // Convert to Boolean
            lime_model_finetune: !!limeModelFinetune, // Convert to Boolean
            scoring: scoring || "f1",
            feature_importance_finetune: !!featureImportanceFinetune, // Convert to Boolean
            num_top_features: numTopFeatures || 20,
            // Clustering Analysis Parameters
            plotter: plotter || "seaborn",
            dim: dim || "3D",
            // Classification Analysis Parameters
            param_finetune: !!paramFinetune, // Convert to Boolean
            finetune_fraction: finetuneFraction || 1.0,
            save_best_model: saveBestModel !== false, // Convert to Boolean, default true
            standard_scaling: standardScaling !== false, // Convert to Boolean, default true
            save_data_transformer: saveDataTransformer !== false, // Convert to Boolean, default true
            save_label_encoder: saveLabelEncoder !== false, // Convert to Boolean, default true
            verbose: verbose !== false, // Convert to Boolean, default true
            // Common parameters
            test_size: testSize || 0.2,
            n_folds: nFolds || 5,
            // String conversion for boolean parameters
            is_diff_analysis: Array.isArray(safeIsDiffAnalysis) ? safeIsDiffAnalysis.join(',') : '',
            after_feature_selection: String(safeAfterFeatureSelection)
        }));
    }
    
    // Print the full command arguments to the console
    console.log("Python command and arguments:", JSON.stringify(pythonArgs));
    
    const pythonCommand = getPythonCommand();
    const python = spawn(pythonCommand, pythonArgs);
    let outputData = [];
    let errorOutput = '';

    python.stdout.on('data', (data) => {
        console.log(`Python stdout: ${data}`);
        const output = data.toString().trim().split('\n');
        
        // Filter only file paths starting with "results/"
        // Use path.sep for Windows compatibility
        const resultsPrefix = path.join('results', ''); // Ensure trailing separator
        const filteredResults = output.filter(p => p.trim().startsWith(resultsPrefix));
        outputData = outputData.concat(filteredResults);
    });

    python.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        errorOutput += data.toString();
    });

    python.on('close', (code) => {
        const endTime = Date.now(); // End time of the process
        const elapsedTime = formatElapsedTime(endTime - startTime); // Calculate elapsed time in a suitable format

        if (code === 0) {
            console.log("output data: ", outputData);
            
            // Mark analysis as finished in DB
            try {
                db.prepare('UPDATE analyses SET status = ?, result_path = ? WHERE id = ?')
                  .run('finished', outputData.join(','), analysisId);
            } catch (err) {
                console.error('Failed to update analysis record:', err);
            }

            // Send the response here
            res.json({
                success: true,
                analysisId: analysisId,
                imagePaths: outputData,
                elapsedTime: elapsedTime
            });
        } else {
            console.error(`Python script failed with code ${code}`);
            // Mark analysis as failed
            try {
                db.prepare('UPDATE analyses SET status = ? WHERE id = ?')
                  .run('failed', analysisId);
            } catch (err) {
                console.error('Failed to set analysis status to failed:', err);
            }
            res.status(500).json({
                success: false,
                message: 'Python script failed',
                error: errorOutput
            });
        }
    });
});

// step8 - Endpoint to summarize statistical methods
app.post('/summarize_statistical_methods', (req, res) => {
    console.log("At summarize statistical methods endpoint.")
    const featureCount = req.body.featureCount || 10; // Default is 10
    const filePath = req.body.filePath;
    const selectedClassPair = req.body.selectedClassPair; // User-selected class pair (optional)
    
    // Extract the file name
    const fileName = path.basename(filePath).split('.')[0];
    
    // Check the feature_ranking directory and find class pairs
    const featureRankingPath = path.join('results', fileName, 'feature_ranking');
    
    try {
        console.log("Checking for feature_ranking directory:", featureRankingPath);
        
        // First, check if the feature_ranking folder exists
        if (!fs.existsSync(featureRankingPath)) {
            console.log("feature_ranking directory does not exist, using classic path");
            
            // Old path, only used if there is a single class pair
            if (selectedClassPair) {
                return res.status(400).json({ success: false, message: 'No feature ranking data found for selected class pair' });
            }
            
            // Create the image file path (old path)
            const pngImagePath = path.join('results', fileName, 'summaryStatisticalMethods', 'png', 'summary_of_statistical_methods_plot.png');
            
            // Try to delete the existing image file if it exists
            try {
                if (fs.existsSync(pngImagePath)) {
                    fs.unlinkSync(pngImagePath);
                    console.log(`Existing image deleted: ${pngImagePath}`);
                }
            } catch (err) {
                console.error(`Error deleting existing image: ${err}`);
            }
            
            const pythonCommand = getPythonCommand();
            const scriptPath = path.join(__dirname, 'services', 'summary_of_statiscical_methods.py');
            const python = spawn(pythonCommand, [
                '-Xfrozen_modules=off', 
                scriptPath,
                filePath,
                String(featureCount) // Convert numeric value to string
            ]);
            
            let outputData = '';
            python.stdout.on('data', (data) => {
                outputData += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            });
            
            python.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Python process exited with code ${code}`);
                    return res.status(500).json({ success: false, message: 'Process failed' });
                }
                
                // Clean up line endings
                const cleanedOutput = outputData.trim();
                console.log(`Python process output: ${cleanedOutput}`);
                
                res.json({ 
                    success: true, 
                    imagePath: cleanedOutput 
                });
            });
            
            return;
        }
        
        // Read class pairs - only get directories
        let classPairs = [];
        try {
            classPairs = fs.readdirSync(featureRankingPath).filter(
                item => {
                    const itemPath = path.join(featureRankingPath, item);
                    // Only process directories and check if each has a ranked_features_df.csv file
                    return fs.statSync(itemPath).isDirectory() && 
                           fs.existsSync(path.join(itemPath, 'ranked_features_df.csv'));
                }
            );
        } catch (error) {
            console.error("Error reading class pair directories:", error);
        }
        
        console.log("Found class pairs:", classPairs);
        
        // If no class pairs are found, return an error
        if (classPairs.length === 0) {
            console.log("No class pairs found with ranked_features_df.csv");
            return res.status(400).json({ 
                success: false, 
                message: 'No class pairs found with ranked_features_df.csv files' 
            });
        }
        
        // If there is no selected class pair and there are multiple class pairs, return them for user selection
        if (!selectedClassPair && classPairs.length > 1) {
            console.log("Multiple class pairs found, asking user for selection:", classPairs);
            return res.json({ 
                success: true, 
                classPairs: classPairs,
                needsSelection: true
            });
        }
        
        // Use the selected class pair or the only one available
        const classToUse = selectedClassPair || classPairs[0];
        console.log("Using class pair:", classToUse);
        
        // Create the output directory for the selected class pair
        const outputDir = path.join('results', fileName, 'summaryStatisticalMethods', classToUse);
        // Create the folders if they do not exist
        fs.mkdirSync(path.join(outputDir, 'png'), { recursive: true });
        fs.mkdirSync(path.join(outputDir, 'pdf'), { recursive: true });
        
        // Try to delete the existing image file if it exists
        const pngImagePath = path.join(outputDir, 'png', 'summary_of_statistical_methods_plot.png');
        try {
            if (fs.existsSync(pngImagePath)) {
                fs.unlinkSync(pngImagePath);
                console.log(`Existing image deleted: ${pngImagePath}`);
            }
        } catch (err) {
            console.error(`Error deleting existing image: ${err}`);
        }
        
        // Create the path for the ranked_features_df file for the class pair
        const csvPath = path.join(featureRankingPath, classToUse, 'ranked_features_df.csv');
        console.log("Using CSV path:", csvPath);
        
        // Check if the CSV path exists
        if (!fs.existsSync(csvPath)) {
            console.error(`CSV file not found at path: ${csvPath}`);
            return res.status(400).json({ 
                success: false, 
                message: `CSV file not found for class pair: ${classToUse}` 
            });
        }
        
        const pythonCommand = getPythonCommand();
        const scriptPath = path.join(__dirname, 'services', 'summary_of_statiscical_methods.py');
        const python = spawn(pythonCommand, [
            '-Xfrozen_modules=off', 
            scriptPath,
            filePath,
            String(featureCount),  // Convert numeric value to string
            classToUse,  // Pass the class pair as a parameter
            csvPath      // Pass the CSV file path as a parameter
        ]);
        
        let outputData = '';
        python.stdout.on('data', (data) => {
            outputData += data.toString();
            console.log(`Python stdout: ${data}`);
        });
        
        python.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
        
        python.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python process exited with code ${code}`);
                return res.status(500).json({ success: false, message: 'Process failed' });
            }
            
            // Clean up line endings
            const cleanedOutput = outputData.trim();
            console.log(`Python process output: ${cleanedOutput}`);
            
            res.json({ 
                success: true, 
                imagePath: cleanedOutput,
                selectedClassPair: classToUse
            });
        });
        
    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.toString() });
    }
});

// Serve static files from the results directory
app.use('/results', express.static(path.join(__dirname, 'results')));
// Serve static files from the sample_report directory
app.use('/sample_report', express.static(path.join(__dirname, 'sample_report')));

// Direct endpoint to serve the bundled sample analysis PDF for environments
// where static file mounting may fail due to proxy or path prefix issues.
app.get('/analysis-report', (req, res) => {
    const reportPath = path.join(__dirname, 'sample_report', 'Biomarker_Sample_Analysis_Report.pdf');
    if (fs.existsSync(reportPath)) {
        return res.sendFile(reportPath);
    }
    return res.status(404).send('Sample analysis report not found on server.');
});

// Disable the default Node.js request timeout so that long-running analyses
// (e.g. Permutation-Feature-Importance) can finish without the connection
// being closed prematurely. Setting the timeout values to 0 removes the limit.
const PORT = 5003;
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Remove all built-in time limits so the client can wait as long as needed
// for heavy analyses to complete.
server.timeout = 0;          // Disable the 2-minute default timeout
server.keepAliveTimeout = 0; // Ensure keep-alive connections stay open
// Node >= 13 introduces headersTimeout; disable it as well for completeness
if (server.headersTimeout !== undefined) {
    server.headersTimeout = 0;
}