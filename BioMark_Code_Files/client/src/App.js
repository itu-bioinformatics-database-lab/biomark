import './css/App.css';
import React, { useState, useRef , useEffect, useMemo, useCallback } from 'react';
import BarChartWithSelection from './components/step4_BarChartWithSelection';
import AnalysisSelection from './components/step5_AnalysisSelection';
import ImagePopup from './components/step8-1_ImagePopup'; // Import the component
import InputFormatPopup from './components/step1_InputFormatPopup'; // Import the new popup component
import AnalysisReport from './components/step9_AnalysisReport';
import SearchableColumnList from './components/SearchableColumnList'; // IMPORT THE NEW COMPONENT
import { api, buildUrl } from './api';
import UserGuideModal from './components/UserGuideModal';

function App() {
  // These are global variables. Values defined inside functions are not accessible everywhere. These solve that problem.
  // State Variables
  const [file, setFile] = useState(null);
  const [multiFiles, setMultiFiles] = useState([]);
  const [mergeDuration, setMergeDuration] = useState(null);
  const fileInputRef = useRef(null); // File input reference
  const [error, setError] = useState('');
  const [previousAnalyses, setPreviousAnalyses] = useState([]); // Stores previous analyses
  const [loading, setLoading] = useState(false); // General loading (e.g. fetching classes, long requests)
  const [uploading, setUploading] = useState(false); // Only true while file is being uploaded
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedInfo, setUploadedInfo] = useState(null);
  const [step2UploadedSnapshot, setStep2UploadedSnapshot] = useState(null);
  const [multiUploadedInfo, setMultiUploadedInfo] = useState([]); // Stores info of multiple uploaded files
  const [activeUploadedIndex, setActiveUploadedIndex] = useState(0); // Active file in step 3
  const [selectedMergedIllnessColumn, setSelectedMergedIllnessColumn] = useState(''); // Active classes in step 4
  const [chosenColumns, setChosenColumns] = useState([]);
  const [showStepOne, setShowStepOne] = useState(true);
  const [showStepTwo, setShowStepTwo] = useState(false);
  const [showStepThree, setShowStepThree] = useState(false);
  const [showStepFour, setShowStepFour] = useState(false);
  const [showStepFive, setShowStepFive] = useState(false);
  const [showStepSix, setShowStepSix] = useState(false);
  const [showStepAnalysis, setShowStepAnalysis] = useState(false);
  const [classTable, setClassTable] = useState({ class: [] }); // Stores class table
  const [isDiffAnalysisClasses, setIsDiffAnalysisClasses] = useState([]); // Stores classes for differential analysis
  const [afterFeatureSelection, setAfterFeatureSelection] = useState(false);
  const [selectedClasses, setselectedClasses] = useState([]);
  const [anotherAnalysis, setAnotherAnalysis] = useState([0]); // Stores analysis blocks
  const [analysisInformation, setAnalysisInformation] = useState([]); // Stores analysis information
  const [columns, setColumns] = useState([]); // Stores column names
  const [selectedIllnessColumn, setSelectedIllnessColumn] = useState(''); // Selected illness column
  const [selectedSampleColumn, setSelectedSampleColumn] = useState(''); // Selected sample column
  const [nonFeatureColumns, setNonFeatureColumns] = useState([]);
  const [selectedFeatureCount, setSelectedFeatureCount] = useState(10); // Default: 10 miRNAs selected
  const [showFormatPopup, setShowFormatPopup] = useState(false); // Controls file format popup
  const [availableClassPairs, setAvailableClassPairs] = useState([]);
  const [allColumns, setAllColumns] = useState([]); // Stores all columns
  const [loadingAllColumns, setLoadingAllColumns] = useState(false); // Loading state for all columns
  const [summarizeAnalyses, setSummarizeAnalyses] = useState([]); // Stores multiple summarize analyses
  const [info, setInfo] = useState('');
  const [processing, setProcessing] = useState(false); // Summarize process state
  const [selectedAnalyzes, setSelectedAnalyzes] = useState({
    differential: [],
    clustering: [],
    classification: [],
  });
  // Parameter States
  const [useDefaultParams, setUseDefaultParams] = useState(true);
  // Differential Analysis Parameters
  const [featureType, setFeatureType] = useState("microRNA");
  const [referenceClass, setReferenceClass] = useState("");
  const [limeGlobalExplanationSampleNum, setLimeGlobalExplanationSampleNum] = useState(50);
  const [shapModelFinetune, setShapModelFinetune] = useState(false);
  const [limeModelFinetune, setLimeModelFinetune] = useState(false);
  const [scoring, setScoring] = useState("f1");
  const [featureImportanceFinetune, setFeatureImportanceFinetune] = useState(false);
  const [numTopFeatures, setNumTopFeatures] = useState(20);
  // Clustering Analysis Parameters
  const [plotter, setPlotter] = useState("seaborn");
  const [dim, setDim] = useState("3D");
  // Classification Analysis Parameters
  const [paramFinetune, setParamFinetune] = useState(false);
  const [finetuneFraction, setFinetuneFraction] = useState(1.0);
  const [saveBestModel, setSaveBestModel] = useState(true);
  const [standardScaling, setStandardScaling] = useState(true);
  const [saveDataTransformer, setSaveDataTransformer] = useState(true);
  const [saveLabelEncoder, setSaveLabelEncoder] = useState(true);
  const [verbose, setVerbose] = useState(true);
  // Common Parameters
  const [testSize, setTestSize] = useState(0.2);
  const [nFolds, setNFolds] = useState(5);
  
  const stepThreeRef = useRef(null);
  const stepFourRef = useRef(null);
  const stepFiveRef = useRef(null);
  const stepSixRef = useRef(null);
  const stepAnalysisRef = useRef(null);
  const pageRef = useRef(null);   // You can define refs for other steps as well.
  const [demoMode, setDemoMode] = useState(false);   // Add demo mode to the app state
  const [imageVersion, setImageVersion] = useState(0);
  const [showUserGuide, setShowUserGuide] = useState(false); // Controls user guide modal

  // State for upload duration (file upload time)
  const [uploadDuration, setUploadDuration] = useState(null);
  const [loadingClasses, setLoadingClasses] = useState(false); // loading while fetching class list

   // Memoize the first 10 columns - prevents recalculation on every render
   const firstTenColumns = useMemo(() => {
    // If allColumns is filled and columns is empty, use the first 10 of allColumns
    if (allColumns.length > 0 && columns.length === 0) {
        return allColumns.slice(0, allColumns.length);
    }
    // Otherwise, use the first 10 of the current columns state
    return columns.slice(0, allColumns.length);
   }, [columns, allColumns]); // Add allColumns as a dependency
  
  // Helper Function: General function to fetch all columns (will use this function)
  const fetchAllColumnsGeneric = async (filePath) => { // filePath should be passed as a parameter
    if (!filePath) {
      console.error("File path is not available for fetching all columns.");
      return [];
    }
    try {
      const response = await api.post('/get_all_columns', {
        filePath: filePath // Use the filePath passed as a parameter
      });
      if (response.data.success) {
        return response.data.columns;
      } else {
        console.error('Error fetching all columns:', response.data.message);
        setError('Failed to fetch all columns in background.'); // Update error message
        return [];
      }
    } catch (error) {
      console.error('Error fetching all columns:', error);
      setError('An error occurred while fetching all columns in background.'); // Update error message
      return [];
    }
  };

  // Function to fetch all columns in the background
  const fetchAllColumnsInBackground = async (filePath) => {
    if (!filePath || loadingAllColumns || allColumns.length > 0) return;

    setLoadingAllColumns(true);
    setError(''); // Clear previous errors
    const fetchedColumns = await fetchAllColumnsGeneric(filePath);
    setAllColumns(fetchedColumns);
    setLoadingAllColumns(false);
    console.log("Fetched all columns in background:", fetchedColumns.length);
  };

  // Helper Function: scrollIntoView function
  const scrollToStep = useCallback((stepRef) => {
    if (stepRef.current) {
      // Add an offset (banner height) so it appears below the banner
      const headerHeight = document.querySelector('.app-header')?.offsetHeight || 0;
      const yOffset = -headerHeight - 20; // Banner height + extra space
      
      const element = stepRef.current;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      
      window.scrollTo({
        top: elementPosition + yOffset,
        behavior: 'smooth'
      });
    }
  }, []);

  // Helper Function: Helper function to truncate long file names
  const truncateFileName = (fileName, maxLength = 25) => {
    if (!fileName || fileName.length <= maxLength) return fileName;
    
    // Separate file name and extension
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // If there is no extension
      return fileName.substring(0, maxLength - 3) + '...';
    }
    
    const name = fileName.substring(0, lastDotIndex);
    const extension = fileName.substring(lastDotIndex);
    
    // If name + ... + extension is longer than maxLength
    if (name.length + 3 + extension.length > maxLength) {
        // Leave space for extension and "..." when truncating the name
        const availableLengthForName = maxLength - 3 - extension.length;
        const truncatedName = name.substring(0, Math.max(0, availableLengthForName));
        return truncatedName + '...' + extension;
    }
    
    return fileName;
  };

  // Step 1: Function to open the format popup
  const handleOpenFormatPopup = () => {
    setShowFormatPopup(true);
  };

  // Step 1: Function to close the format popup
  const handleCloseFormatPopup = () => {
    setShowFormatPopup(false);
  };

  // Step 1: Handles clicking the Browse button and selecting a file
  const handleBrowseClick = () => {
    setFile(null); // Show file name when a file is selected
    setInfo(''); // Clear info message
    
    // Reset FileInput value
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
    
    document.getElementById('fileInput').click(); // Trigger the input element
  };

  // Step 1: Handles actions when the demo file is selected
  const handleDemoFileClick = async () => {
    // Record the start time to calculate the loading duration later
    const startTime = performance.now();
    setDemoMode(true);
    setLoading(true);
    setInfo('Loading demo dataset...');
    setFile(new File([""], "GSE120584_serum_norm_demo.csv", { type: "text/csv" }));
    setError(''); // Clear errors
    setAllColumns([]); // Clear previous all columns
    
    try {
      const response = await api.get("/get-demo-data");
      console.log("Demo data response:", response.data);
      
      if (response.data && response.data.filePath) {
        const demoFilePath = response.data.filePath;
        // Convert bytes to human-readable MB with one decimal
        const prettySize = response.data.fileSize ? `${(response.data.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'N/A';

        setUploadedInfo({
          name: "GSE120584_serum_norm_demo.csv",
          size: prettySize,
          filePath: demoFilePath,
        });
        // Also set the first columns to state (if backend provides them)
        setColumns(response.data.columns || []);
        setShowStepTwo(true);
        setShowStepThree(true);
        
        // Fetch all columns in the background (with path)
        fetchAllColumnsInBackground(demoFilePath);

        // Calculate and display the loading time in seconds with two decimals
        const loadTimeSec = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`Demo dataset loaded in ${loadTimeSec} seconds.`);
        setInfo(`Demo dataset loaded in ${loadTimeSec} seconds.`);
        setUploadDuration(`${loadTimeSec} s`);
        // Hide the info message after a short delay so it does not clutter the UI
        setTimeout(() => setInfo(''), 5000);

        // Scrolling is handled by useEffect

      } else {
        setError('Demo data could not be retrieved or file path missing.');
      }
    } catch (error) {
      console.error("Error getting demo data:", error);
      setError('Failed to retrieve demo data: ' + (error.response?.data?.message || error.message || 'Unknown error'));
    } finally {
      setLoading(false);
      setInfo('');
    }
  };

  // Step 1: Updates state after a file is selected
  const handleFileChange = (e) => {
    setDemoMode(false);     // Turn off demo mode when file changes
    setStep2UploadedSnapshot(null);
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 1) {
      setFile(selectedFiles[0]);
      setMultiFiles([]);
      setError('');
      setShowStepTwo(true);
      setUploadedInfo(null);
      setColumns([]);
      setAllColumns([]);
      setShowStepThree(false);
    } else if (selectedFiles.length > 1) {
      setFile(null); // Tekli dosya state'i temizle
      setMultiFiles(selectedFiles);
      setError('');
      setShowStepTwo(true);
      setUploadedInfo(null);
      setColumns([]);
      setAllColumns([]);
      setShowStepThree(false);
    }
  };

  // Step 2: Handles actions when the Upload button is clicked
  const handleUpload = async () => {
    // If in demo mode, call the relevant function and exit
    if (demoMode) {
      handleDemoFileClick();
      return;
    }

    // Multi-file upload branch
    if (multiFiles.length > 1) {
      setUploading(true);
      setLoading(true);
      setError('');
      setAllColumns([]);
      const uploadedFilesInfo = [];
      const uploadDurations = [];
    
      for (let i = 0; i < multiFiles.length; i++) {
        const file = multiFiles[i];
        const formData = new FormData();
        formData.append('file', file);
      
        const uploadStartTime = Date.now();
        try {
          const response = await api.post('/upload', formData); // Tek dosya endpointi
          if (response.data.success && response.data.filePath) {
            uploadedFilesInfo.push({
              name: file.name,
              size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
              filePath: response.data.filePath,
            });
            const duration = ((Date.now() - uploadStartTime) / 1000).toFixed(2) + ' s';
            uploadDurations.push(duration);
            if (i === 0) {
              setColumns(response.data.columns || []);
              fetchAllColumnsInBackground(response.data.filePath);
            }
          } else {
            uploadedFilesInfo.push({
              name: file.name,
              size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
              filePath: null,
            });
            uploadDurations.push('Failed');
          }
        } catch (error) {
          uploadedFilesInfo.push({
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            filePath: null,
          });
          uploadDurations.push('Error');
        }
      }
    
      setUploadedInfo(uploadedFilesInfo);     
      setMultiUploadedInfo(uploadedFilesInfo);   // Save all uploaded files info
      
      
      // initialize chosenColumns for all uploaded files
      setChosenColumns(uploadedFilesInfo.map(info => ({
        filePath: info.filePath,
        illnessColumn: '',
        sampleColumn: ''
      })));
      
      
      setUploadDuration(uploadDurations);
      setUploading(false);
      setLoading(false);
      
      setInfo('Multi-file upload completed. Select Patient Group and Sample ID columns');
      setShowStepThree(true);
      
      setStep2UploadedSnapshot(uploadedFilesInfo);
      
      // setInfo('Merging files...');
      // const mergeStartTime = Date.now();
      
      // // File paths for merging
      // const filePaths = uploadedFilesInfo.map(info => info.filePath).filter(Boolean);
      
      // // If all files uploaded successfully, call merge endpoint
      // if (filePaths.length === multiFiles.length) {
        //   try {
          //     const mergeResponse = await api.post('/merge-files', { filePaths });
          
          //     const mergeEndTime = Date.now();
          //     const mergeTime = ((mergeEndTime - mergeStartTime) / 1000).toFixed(2) + ' s';
          //     setMergeDuration(mergeTime);
          
          //     if (mergeResponse.data.success && mergeResponse.data.mergedFilePath) {
            //       setInfo('Files merged successfully.');
            
      //       setUploadedInfo({
      //         name: 'merged.csv',
      //         size: mergeResponse.data.size ? `${(mergeResponse.data.size / (1024 * 1024)).toFixed(2)} MB` : '',
      //         filePath: mergeResponse.data.mergedFilePath,
      //       });
      //       setColumns(mergeResponse.data.columns || []);
      //       setShowStepThree(true);
      //       fetchAllColumnsInBackground(mergeResponse.data.mergedFilePath);
      //     } else {
      //       setError('Files merged failed.');
      //       setInfo('');
      //     }
      //   } catch (error) {
      //     setError('Files merge failed.');
      //   }
      // }
      return;
    }


    // Single file upload branch
    setMergeDuration(null);

    if (!file) {
      setError('Please select a file!');
      setLoading(false); // Not even started loading
      return;
    }
    
    // Extension Check
    const validTypes = [
      'text/csv',
      'text/plain',
      'application/gzip',
      'application/x-gzip',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip'
    ];

    // Check MIME type, if not, check file extension
    let isValidType = validTypes.includes(file.type);
    if (!isValidType && file.name) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['csv','tsv','txt','xlsx','gz','zip'];
        if (allowedExtensions.includes(fileExtension)) {
            isValidType = true;
        }
         // Special check for gzip (MIME type may be wrong sometimes)
         if (fileExtension === 'gz' && !isValidType) isValidType = true;
    }


    if (!isValidType) {
        setError('Please upload a valid file (CSV, TSV, TXT, XLSX, GZ, or ZIP).');
        setLoading(false); // Reset loading state
        return;
    }

    // Upload is starting
    const uploadStartTime = Date.now(); // Start time for duration measurement
    setUploadDuration(null); // Reset previous measurement
    setUploading(true);
    setLoading(true);
    setError(''); // Clear previous errors
    setAllColumns([]); // Clear previous all columns

    const formData = new FormData();
    formData.append('file', file);

    try {
      // First, upload the file to /upload endpoint and get the first columns
      const response = await api.post('/upload', formData);
      console.log("Upload response:", response.data);

      if (response.data.success && response.data.filePath) {
        const uploadedFilePath = response.data.filePath;
        // Save the first columns to state
        setColumns(response.data.columns || []);
        setUploadedInfo({
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          filePath: uploadedFilePath,
        });

        setStep2UploadedSnapshot({
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          filePath: uploadedFilePath,
        });
        setShowStepThree(true); // Show step three

        // Fetch ALL columns in the background
        fetchAllColumnsInBackground(uploadedFilePath);

        // Scrolling is handled by useEffect

      } else {
         // Failed upload case
         setError(response.data.message || 'File upload failed. Please check the file format and try again.');
         // If failed, do not show next steps
         setShowStepThree(false);
         setUploadedInfo(null);
         setColumns([]);
      }
    } catch (error) {
      setError('An error occurred during upload. Please try again.');
      console.error('Error uploading file:', error.message || error);
      // Hide next steps in case of error
      setShowStepThree(false);
      setUploadedInfo(null);
      setColumns([]);
    } finally {
      // Upload finished (success or failure)
      const durationSeconds = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      setUploadDuration(`${durationSeconds} s`);
      setLoading(false);
      setUploading(false);
      setInfo('');
    }
  };

  const handleSelectUploadedFile = async (index) => {
    if (!multiUploadedInfo || !multiUploadedInfo[index]) return;

    // set active file immediately (visual feedback)
    setActiveUploadedIndex(index);
    const info = multiUploadedInfo[index];
    setUploadedInfo(info); // step3/step4 için kullanýlacak

    // Disable column selectors and clear old columns while loading new ones
    setLoadingAllColumns(true);
    setColumns([]); // clear old columns

    try {
      const cols = await fetchAllColumnsGeneric(info.filePath);
      setColumns(cols || []);

      // restore per-file selections for this file if present
      const perFile = Array.isArray(chosenColumns) && chosenColumns[index] ? chosenColumns[index] : null;
      if (perFile) {
        setSelectedIllnessColumn(perFile.illnessColumn || '');
        setSelectedSampleColumn(perFile.sampleColumn || '');
      } else {
        // if empty, clear selections
        setSelectedIllnessColumn('');
        setSelectedSampleColumn('');
      }
    } catch (err) {
      console.error('Error fetching columns for selected uploaded file:', err);
      setError('Failed to load columns for the selected file.');
      setColumns([]);
      setSelectedIllnessColumn('');
      setSelectedSampleColumn('');
    } finally {
      setLoadingAllColumns(false);
    }
  };

  const updateChosenColumnForFile = (index, key, value) => {
    setChosenColumns(prev => {
      const copy = Array.isArray(prev) ? [...prev] : [];
      copy[index] = { ...(copy[index] || {}), [key]: value, filePath: multiUploadedInfo[index]?.filePath };
      return copy;
    });
  };

  // wrapper used by SearchableColumnList components in Step 3:
  const handleIllnessColumnSelectionForFile = (col) => {
    updateChosenColumnForFile(activeUploadedIndex, 'illnessColumn', col);
    // also keep global selection for current view (so existing flow still works)
    setSelectedIllnessColumn(col);
    // call existing logic to fetch classes based on current uploadedInfo.filePath
    handleIllnessColumnSelection(col);
  };

  const handleSampleColumnSelectionForFile = (col) => {
    updateChosenColumnForFile(activeUploadedIndex, 'sampleColumn', col);
    setSelectedSampleColumn(col);
    handleSampleColumnSelection(col);
  };

  const handleMergeAfterStep3 = async () => {
    // validate
    if (!chosenColumns || chosenColumns.length < 2) {
      setError('Please select Patient Group & Sample ID for each uploaded file before merging.');
      return;
    }
    const incomplete = chosenColumns.some(c => !c.illnessColumn || !c.sampleColumn || !c.filePath);
    if (incomplete) {
      setError('Some files are missing selections. Please complete selections for all files.');
      return;
    }

    setError('');
    setInfo('Merging files...');
    setLoading(true);
    const mergeStart = Date.now();
    console.log("Merging files with chosen columns:", chosenColumns);
    try {
      const res = await api.post('/merge-files', { chosenColumns }); // backend should accept this structure
      if (res.data.success && res.data.mergedFilePath) {
        const mergeTime = ((Date.now() - mergeStart) / 1000).toFixed(2) + ' s';
        setMergeDuration(mergeTime);
        setUploadedInfo({
          name: 'merged.csv',
          size: res.data.size ? `${(res.data.size / (1024*1024)).toFixed(2)} MB` : '',
          filePath: res.data.mergedFilePath
        });
        setColumns(res.data.columns || []);
        setAllColumns(res.data.columns || []);
        fetchAllColumnsInBackground(res.data.mergedFilePath);

        const fallback = chosenColumns && chosenColumns.length ? chosenColumns[0] : null;
        const mergedSelection = fallback || {};
        if (mergedSelection.illnessColumn) setSelectedIllnessColumn(mergedSelection.illnessColumn);
        if (mergedSelection.sampleColumn) setSelectedSampleColumn(mergedSelection.sampleColumn);

        // <-- BEGIN: Fetch classes for the merged file and populate Step 4
        if (mergedSelection.illnessColumn) {
          try {
            setLoadingClasses(true);
            const clsResp = await api.post('/get_classes', {
              filePath: res.data.mergedFilePath,
              columnName: mergedSelection.illnessColumn
            });
            if (clsResp.data.success && clsResp.data.classList_) {
              let classes = [];
              let diagramUrl = '';
              try {
                if (Array.isArray(clsResp.data.classList_) && clsResp.data.classList_.length >= 2) {
                  classes = JSON.parse(clsResp.data.classList_[0].replace(/'/g, '"'));
                  diagramUrl = clsResp.data.classList_[1];
                } else {
                  classes = JSON.parse(clsResp.data.classList_.replace(/'/g, '"'));
                }
              } catch (parseError) {
                console.error("Failed to parse class list from merge get_classes:", parseError);
                classes = [];
              }
              setClassTable({ class: classes, classDiagramUrl: diagramUrl });
              setselectedClasses([]); // reset selection for Step 4
            } else {
              console.warn("get_classes returned no classList_ for merged file", clsResp.data);
            }
          } catch (err) {
            console.error("Failed fetching classes for merged file:", err);
            setError('Failed to fetch classes for merged file.');
          } finally {
            setLoadingClasses(false);
          }
        }
        // <-- END

        setInfo('Files merged successfully.');
        setShowStepFour(true);
        setTimeout(() => {
          if (stepFourRef.current) scrollToStep(stepFourRef);
        }, 100);
      } else {
        setError(res.data.message || 'Merge failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Merge request failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Select the disease column
  const handleIllnessColumnSelection = async (illnessColumn) => {
    console.log("handleIllnessColumnSelection called with:", illnessColumn);
    setError('');
    setSelectedIllnessColumn(illnessColumn);
    if (illnessColumn === selectedSampleColumn) {
        setSelectedSampleColumn(''); // Reset Sample ID if same as illness column
        setInfo("Patient Group and Sample ID columns cannot be the same. Sample ID selection reset.");
        setTimeout(() => setInfo(''), 3000);
    }
    setClassTable({ class: [] }); // Clear class table for new query

    // If multiple files uploaded and merge not done yet, DO NOT call get_classes here.
    const multiUploadInProgress = Array.isArray(multiUploadedInfo) && multiUploadedInfo.length > 1 && !mergeDuration;
    if (multiUploadInProgress) {
      // keep the selection locally (chosenColumns updated elsewhere) and inform user
      setInfo('Selection saved for this file. Classes will be fetched after merge.');

      return;
    }

    if (uploadedInfo?.filePath) {
        try {
          setLoadingClasses(true);
          const response = await api.post('/get_classes', {
                filePath: uploadedInfo.filePath,
                columnName: illnessColumn,
          });
          console.log("Get classes response: ",response.data);
          if (response.data.success && response.data.classList_) {
            // Safely parse JSON
            let classes = [];
            let diagramUrl = '';
            try {
                if (Array.isArray(response.data.classList_) && response.data.classList_.length >= 2) {
                    classes = JSON.parse(response.data.classList_[0].replace(/'/g, '"'));
                    diagramUrl = response.data.classList_[1];
                } else {
                    classes = JSON.parse(response.data.classList_.replace(/'/g, '"'));
                }
            } catch (parseError) {
                console.error("Failed to parse class list:", parseError);
                setError("Failed to parse class information from server.");
                classes = [];
            }
  
            setClassTable({
              class: classes,
              classDiagramUrl: diagramUrl,
            });
            setselectedClasses([]); // Reset selected classes since new column is selected

            const multiUploadInProgressAgain = Array.isArray(multiUploadedInfo) && multiUploadedInfo.length > 1 && !mergeDuration;
            if (selectedSampleColumn && illnessColumn && !multiUploadInProgressAgain) {
                setShowStepFour(true);
                setTimeout(() => {
                    if (stepFourRef.current) scrollToStep(stepFourRef);
                }, 100);
            }
        
      } else {
        setError('Failed to retrieve classes for the selected column.');
            setClassTable({ class: [] });
      }
    } catch (error) {
      setError('An error occurred while fetching classes. Please try again.');
      console.error('Error fetching classes:', error.message || error);
          setClassTable({ class: [] });
        } finally {
            setLoadingClasses(false);
        }
    } else {
        setError("Cannot fetch classes: Uploaded file information is missing.");
    }
  };

  const handleSampleColumnSelection = async (sampleColumn) => {
    console.log("handleSampleColumnSelection called with:", sampleColumn);
    setError('');
    if (sampleColumn === selectedIllnessColumn) {
        setError("Sample ID and Patient Group columns cannot be the same.");
        return; 
    }
    setSelectedSampleColumn(sampleColumn);
    
    // If Patient Group column is also selected, scroll to Step 4
    const multiUploadInProgress = Array.isArray(multiUploadedInfo) && multiUploadedInfo.length > 1 && !mergeDuration;
    if (selectedIllnessColumn && sampleColumn && !multiUploadInProgress) {
        setShowStepFour(true);
        setTimeout(() => {
            if (stepFourRef.current) scrollToStep(stepFourRef);
        }, 100);
    }
  };

  // Show Step 4: When both columns (Illness & Sample) are selected
  useEffect(() => {
    // Eðer çoklu dosya yüklendiyse ve henüz merge yapýlmadýysa -> Step 4'ü hiçbir koþulda otomatik açma
    const multiUploadInProgress = Array.isArray(multiUploadedInfo) && multiUploadedInfo.length > 1 && !mergeDuration;

    if (multiUploadInProgress) {
      setShowStepFour(false);

      // Bilgilendirme: tüm dosyalar için seçim tamamlandýysa farklý mesaj göster
      const allFilesHaveSelection = Array.isArray(chosenColumns)
        && chosenColumns.length === multiUploadedInfo.length
        && chosenColumns.every(c => c && c.illnessColumn && c.sampleColumn);

      if (allFilesHaveSelection) {
        setInfo('Selections saved for each file. Please Merge files to continue to Step 4.');
      } else {
        setInfo('Please complete Patient Group and Sample ID selections for each file before merging.');
      }
      return;
    }

    // Normal flow: single file or after merge, show Step 4 based on global selections
    if (selectedIllnessColumn && selectedSampleColumn) {
      // setInfo('');
      setShowStepFour(true);
      setTimeout(() => {
        if (stepFourRef.current) scrollToStep(stepFourRef);
      }, 100);
      return;
    }

    // Her iki kolon da seçili deðilse sonraki adýmlarý gizle
    setShowStepFour(false);
    setShowStepFive(false);
    setShowStepSix(false);
    setShowStepAnalysis(false);
    setselectedClasses([]);
    if (!selectedIllnessColumn) setClassTable({ class: [] });

  }, [selectedIllnessColumn, selectedSampleColumn, multiUploadedInfo, mergeDuration, chosenColumns, stepFourRef, scrollToStep]);

  // Show Step 5: When Step 4 is visible and 2 classes are selected
  useEffect(() => {
    console.log("[Effect Check Step 5 Visibility] showStepFour:", showStepFour, "selectedClasses:", selectedClasses.length);
    if (showStepFour && selectedClasses.length === 2) {
        console.log("[Effect Check Step 5 Visibility] Setting showStepFive to TRUE");
        setShowStepFive(true);
    } else {
        // Only log if showStepFive is true
        if (showStepFive) {
            console.log("[Effect Check Step 5 Visibility] Setting showStepFive to FALSE");
        }
        setShowStepFive(false);
        // When Step 5 is hidden, also hide later steps
        setShowStepSix(false);
        setShowStepAnalysis(false);
    }
  }, [showStepFour, showStepFive, selectedClasses, setShowStepFive, setShowStepSix, setShowStepAnalysis]);

  const handleClassSelection = async (newlySelectedClasses) => {
    // Ensure the array always has 2 elements (BarChartWithSelection should enforce this)
    if (Array.isArray(newlySelectedClasses) && newlySelectedClasses.length === 2) {
        setselectedClasses(newlySelectedClasses);
        console.log("Selected classes: ", newlySelectedClasses);
        setShowStepFive(true); // Show Step 5 when classes are selected

        // Scroll to Step 5
        setTimeout(() => {
          if (stepFiveRef.current) scrollToStep(stepFiveRef);
        }, 100);
    } else {
        console.warn("handleClassSelection received invalid selection:", newlySelectedClasses);
        // In case of error, reset state or show error message
        setselectedClasses([]);
        setShowStepFive(false);
    }
  };

  const handleMergedIllnessColumnSelect = async (col) => {
    setError('');
    setSelectedMergedIllnessColumn(col);
    // uploadedInfo.filePath burada merged dosyanýn path'i olmalý
    if (!uploadedInfo?.filePath) {
      setError('Merged file not available for fetching classes.');
      return;
    }
    try {
      setLoadingClasses(true);
      const clsResp = await api.post('/get_classes', {
        filePath: uploadedInfo.filePath,
        columnName: col
      });
      if (clsResp.data.success && clsResp.data.classList_) {
        let classes = [];
        let diagramUrl = '';
        try {
          if (Array.isArray(clsResp.data.classList_) && clsResp.data.classList_.length >= 2) {
            classes = JSON.parse(clsResp.data.classList_[0].replace(/'/g, '"'));
            diagramUrl = clsResp.data.classList_[1];
          } else {
            classes = JSON.parse(clsResp.data.classList_.replace(/'/g, '"'));
          }
        } catch (parseError) {
          console.error("Failed to parse class list:", parseError);
          classes = [];
        }
        setClassTable({ class: classes, classDiagramUrl: diagramUrl });
        setselectedClasses([]); // reset selections for step 4
      } else {
        setError('Failed to retrieve classes for the selected merged column.');
        setClassTable({ class: [] });
      }
    } catch (err) {
      console.error("Error fetching classes for merged file:", err);
      setError('Error fetching classes for merged file.');
      setClassTable({ class: [] });
    } finally {
      setLoadingClasses(false);
    }
  };

  // 5.AdÄ±m: SeÃ§ilen analizleri state'e kaydeder. 
  const handleAnalysisSelection = async (selectedAnalyzesUpdate) => {
    console.log("handleAnalysisSelection called with:", selectedAnalyzesUpdate);

    // Check the structure of the incoming data
    if (!selectedAnalyzesUpdate || typeof selectedAnalyzesUpdate !== 'object') {
        console.error("Invalid data received in handleAnalysisSelection");
        return;
    }

    const { differential = [], clustering = [], classification = [], useDefaultParams: useDefault, parameters } = selectedAnalyzesUpdate;

    // Update states
    if (differential.length > 0) {
      setIsDiffAnalysisClasses(selectedClasses); // This is also similar to selectedClasses
    } else {
        setIsDiffAnalysisClasses([]);
    }

    setAfterFeatureSelection(false); // Reset feature selection state on new analysis selection
    // If differential is selected and classes are the same, check after feature selection state (logic can be improved)
    if (differential.length > 0 && isDiffAnalysisClasses[0] === selectedClasses[0] && isDiffAnalysisClasses[1] === selectedClasses[1]){
      // setAfterFeatureSelection(true); // Better to set this based on analysis results
    }

    setSelectedAnalyzes({ differential, clustering, classification });
    setUseDefaultParams(useDefault);

    // Update parameters if custom params are selected
    if (!useDefault && parameters) {
        setFeatureType(parameters.featureType ?? "microRNA");
        setReferenceClass(parameters.referenceClass ?? "");
        setLimeGlobalExplanationSampleNum(parameters.limeGlobalExplanationSampleNum ?? 50);
        setShapModelFinetune(parameters.shapModelFinetune ?? false);
        setLimeModelFinetune(parameters.limeModelFinetune ?? false);
        setScoring(parameters.scoring ?? "f1");
        setFeatureImportanceFinetune(parameters.featureImportanceFinetune ?? false);
        setNumTopFeatures(parameters.numTopFeatures ?? 20);
        setPlotter(parameters.plotter ?? "seaborn");
        setDim(parameters.dim ?? "3D");
        setParamFinetune(parameters.paramFinetune ?? false);
        setFinetuneFraction(parameters.finetuneFraction ?? 1.0);
        setSaveBestModel(parameters.saveBestModel ?? true);
        setStandardScaling(parameters.standardScaling ?? true);
        setSaveDataTransformer(parameters.saveDataTransformer ?? true);
        setSaveLabelEncoder(parameters.saveLabelEncoder ?? true);
        setVerbose(parameters.verbose ?? true);
        setTestSize(parameters.testSize ?? 0.2);
        setNFolds(parameters.nFolds ?? 5);
    } else {
        // Optionally reset to default parameters
    }

    setShowStepSix(true); // Show Step 6 after analysis selection
    // Scroll is handled in useEffect
    // scrollToStep(stepSixRef);

    setInfo('Analysis method selected. You can now optionally exclude non-feature columns.');
    setTimeout(() => setInfo(''), 5000); // Message duration

    console.log("handleAnalysisSelection finished. State updated:", { differential, clustering, classification, useDefaultParams: useDefault });
  };


  // Step 6: Adding a non-feature column
  const handleAddNonFeatureColumn = (columnToAdd) => {
    // Build set of protected columns: global selections + per-file selections
    const protectedCols = new Set();
    if (selectedIllnessColumn) protectedCols.add(selectedIllnessColumn);
    if (selectedSampleColumn) protectedCols.add(selectedSampleColumn);

    if (Array.isArray(chosenColumns)) {
      chosenColumns.forEach((c) => {
        if (c?.illnessColumn) protectedCols.add(c.illnessColumn);
        if (c?.sampleColumn) protectedCols.add(c.sampleColumn);
      });
    }

    // If the column is protected, show a descriptive message including source(s)
    if (protectedCols.has(columnToAdd)) {
      const sources = [];

      if (selectedIllnessColumn === columnToAdd) sources.push('current Patient Group');
      if (selectedSampleColumn === columnToAdd) sources.push('current Sample ID');

      if (Array.isArray(chosenColumns) && Array.isArray(multiUploadedInfo)) {
        chosenColumns.forEach((c, idx) => {
          const shortName = multiUploadedInfo[idx]?.name || `file ${idx + 1}`;
          if (c?.illnessColumn === columnToAdd) sources.push(`Patient Group from ${truncateFileName(shortName, 30)}`);
          if (c?.sampleColumn === columnToAdd) sources.push(`Sample ID from ${truncateFileName(shortName, 30)}`);
        });
      }

      setInfo(`Column "${columnToAdd}" is already selected as Patient Group or Sample ID. It cannot be excluded.`);
      setTimeout(() => setInfo(''), 3000);
      return;
    }

    // Add if not already selected
    if (!nonFeatureColumns.includes(columnToAdd)) {
      setNonFeatureColumns((prev) => [...prev, columnToAdd].sort());
    }
  };

  // 6.AdÄ±m: GÃ¶rÃ¼ntÃ¼lenen etiketten bir non-feature sÃ¼tunu kaldÄ±rma
  const handleRemoveNonFeatureColumn = (columnToRemove) => {
    setNonFeatureColumns((prev) => prev.filter((col) => col !== columnToRemove));
    // Logic for hiding Step 7 is in useEffect (if needed)
  };

  // 7.AdÄ±m: Run Analysis butonuna tÄ±klandÄ±ÄŸÄ±nda
  const handleRunAnalysis = async () => {
    // Check if all required selections are made
    if (!uploadedInfo?.filePath || !selectedIllnessColumn || !selectedSampleColumn || selectedClasses.length !== 2) {
        setError("Please complete all selections in steps 3 and 4 before running the analysis.");
        setAnalyzing(false);
        return;
    }
    // Check if at least one analysis type is selected
     if (selectedAnalyzes.differential.length === 0 && selectedAnalyzes.clustering.length === 0 && selectedAnalyzes.classification.length === 0) {
         setError("Please select at least one analysis method in step 5.");
         setAnalyzing(false);
         return;
     }

    const payload = {
      filePath: uploadedInfo.filePath,
      IlnessColumnName: selectedIllnessColumn,
      SampleColumnName: selectedSampleColumn,
      selectedClasses: selectedClasses,
      differential: selectedAnalyzes.differential,
      clustering: selectedAnalyzes.clustering,
      classification: selectedAnalyzes.classification,
      nonFeatureColumns: nonFeatureColumns,
      isDiffAnalysis: selectedAnalyzes.differential, // Add differential analyses directly here
      afterFeatureSelection: afterFeatureSelection, // Add after feature selection state
      useDefaultParams: useDefaultParams,
      featureType: featureType,
      referenceClass: referenceClass,
      limeGlobalExplanationSampleNum: limeGlobalExplanationSampleNum,
      shapModelFinetune: shapModelFinetune,
      limeModelFinetune: limeModelFinetune,
      scoring: scoring,
      featureImportanceFinetune: featureImportanceFinetune,
      numTopFeatures: numTopFeatures,
      plotter: plotter,
      dim: dim,
      paramFinetune: paramFinetune,
      finetuneFraction: finetuneFraction,
      saveBestModel: saveBestModel,
      standardScaling: standardScaling,
      saveDataTransformer: saveDataTransformer,
      saveLabelEncoder: saveLabelEncoder,
      verbose: verbose,
      testSize: testSize,
      nFolds: nFolds
    };

    console.log("Running analysis with payload:", payload);
    setError('');
    setAnalyzing(true);

    try {
      const response = await api.post('/analyze', payload);
      console.log("Analysis response:", response.data);
      if (response.data.success) {
      // Create a new analysis object and add to previous
      const newAnalysis = {
          results: response.data.imagePaths || [],
          time: response.data.elapsedTime || "N/A",
          date: new Date().toLocaleString('en-GB'),
          parameters: payload,
          analysisInfo: { ...selectedAnalyzes }
        };

        // If differential analysis is performed and "AfterFeatureSelection" folder exists in results, feature selection is done
        if (selectedAnalyzes.differential && selectedAnalyzes.differential.length > 0) {
          const hasFeatureSelection = response.data.imagePaths.some(
            path => path.includes('AfterFeatureSelection') || path.includes('afterFeatureSelection')
          );
          if (hasFeatureSelection) {
            setAfterFeatureSelection(true);
            console.log("Feature Selection performed, afterFeatureSelection state set to true");
          }
        }

        // Update previous analyses and information
        setPreviousAnalyses((prev) => [...prev, newAnalysis]);
        setAnalysisInformation((prev) => [...prev, payload]);

        // After analysis, hide current steps (results will be shown)
      setShowStepOne(false);
      setShowStepTwo(false);
      setShowStepThree(false);
      setShowStepFour(false);
      setShowStepFive(false);
      setShowStepSix(false);
      setShowStepAnalysis(false);

        // Scroll to the section with results (Post-analysis options)
        setTimeout(() => {
            if (pageRef.current) scrollToStep(pageRef);
        }, 100);

      } else {
        setError(response.data.message || 'An error occurred during analysis. Please check the server logs.');
      }
    } catch (error) {
      setError('An error occurred during analysis communication. Please try again.');
      console.error('Error analyzing file:', error.message || error);
    } finally {
        setAnalyzing(false);
    }

  };

  // 7.AdÄ±m: Analizi baÅŸlatma tetikleyicisi (Run Analysis butonu iÃ§in)
  const handleStartAnalysis =() => {
    // Analiz zaten Ã§alÄ±ÅŸmÄ±yorsa baÅŸlat
    if (!analyzing) {
    handleRunAnalysis();
  }
  }

  // Final AdÄ±mÄ± 1: Yeni analiz yapma butonu
  const handlePerformAnotherAnalysis = () => {
    // Hide current steps (3, 4, 5, 6, 7) and update state for a new analysis block
    // This function does not actually add a new analysis block, just shows previous steps again.
    // If a truly new analysis block is needed, previousAnalyses logic should be changed.
    // For now, just go back to Step 3.
    setAnotherAnalysis((prev) => [...prev, prev.length]); // Only used as index
    console.log("Performing another analysis, resetting to Step 3...");

    // Show/hide steps for new analysis
    setShowStepThree(true);
    setShowStepFour(true);
    setShowStepFive(false);
    setShowStepSix(false);
    setShowStepAnalysis(false);
    
    // Optionally reset previous selections (user may want to continue)
    setClassTable({ class: [] });
    setselectedClasses([]);
    setSelectedAnalyzes({ differential: [], clustering: [], classification: [] });
    setUseDefaultParams(true);
    // Optionally reset parameters as well.

    // If previous selectedIllnessColumn exists, reload classTable
    if (selectedIllnessColumn) {
      // Directly calling handleIllnessColumnSelection may not have the expected effect due to timing of state updates.
      // But this should trigger the API call.
      handleIllnessColumnSelection(selectedIllnessColumn);
    }

    setTimeout(() => {
      const targetRef = stepFourRef.current || stepThreeRef.current;
      if (targetRef) {
        scrollToStep(targetRef);
      }
    }, 200); // Wait a bit for API call and state updates
  };

  // Final AdÄ±mÄ± 2: BaÅŸtan baÅŸlama butonu
  const handleStartOver = () => {
    // Reset the file input safely
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }

    // Reset all states to initial values
    setFile(null);
    setLoading(false);
    setAnalyzing(false);
    setProcessing(false);
    setPreviousAnalyses([]);
    setAnalysisInformation([]);
    setAnotherAnalysis([0]);
    setUploadedInfo(null);
    setShowStepOne(true);
    setShowStepTwo(false);
    setShowStepThree(false);
    setShowStepFour(false);
    setShowStepFive(false);
    setShowStepSix(false);
    setShowStepAnalysis(false);
    setClassTable({ class: [] });
    setselectedClasses([]);
    setColumns([]);
    setAllColumns([]);
    setLoadingAllColumns(false);
    setSelectedIllnessColumn('');
    setSelectedSampleColumn('');
    setNonFeatureColumns([]);
    setIsDiffAnalysisClasses([]);
    setSummarizeAnalyses([]);
    setAvailableClassPairs([]);
    setError('');
    setInfo('');
    setDemoMode(false);

    setSelectedAnalyzes({
      differential: [],
      clustering: [],
      classification: [],
    });
    
    // Reset parameter states
    setUseDefaultParams(true);    
    setFeatureType("microRNA");
    setReferenceClass("");
    setLimeGlobalExplanationSampleNum(50);
    setShapModelFinetune(false);
    setLimeModelFinetune(false);
    setScoring("f1");
    setFeatureImportanceFinetune(false);
    setNumTopFeatures(20);
    setPlotter("seaborn");
    setDim("3D");
    setParamFinetune(false);
    setFinetuneFraction(1.0);
    setSaveBestModel(true);
    setStandardScaling(true);
    setSaveDataTransformer(true);
    setSaveLabelEncoder(true);
    setVerbose(true);
    setTestSize(0.2);
    setNFolds(5);
    // Reset upload duration
    setUploadDuration(null);
    setStep2UploadedSnapshot(null);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final AdÄ±mÄ± Summarize: Ä°statistiksel yÃ¶ntemleri Ã¶zetle
  const handleSummarizeStatisticalMethods = async (selectedClassPair = null) => {
    if (!uploadedInfo?.filePath) {
        setError("Cannot summarize: File path is missing.");
        return;
    }

    // Check if any differential analysis has been performed
    const hasDifferentialAnalyses = previousAnalyses.some(
      analysis => analysis.parameters && 
                  analysis.parameters.differential && 
                  analysis.parameters.differential.length > 0
    );

    if (!hasDifferentialAnalyses) {
      setError("No differential analyses found to combine. Please run a differential analysis first.");
      setProcessing(false);
      return;
    }

    // If class pair selection is required and not selected, send empty to API (let API decide)
    // If class pair selection modal is open, this function should not be called again (should be disabled)

    setProcessing(true);
    setError('');

    console.log("Summarize request - selectedClassPair:", selectedClassPair, "featureCount:", selectedFeatureCount);

    try {
      const response = await api.post('/summarize_statistical_methods', {
        featureCount: selectedFeatureCount,
        filePath: uploadedInfo.filePath,
        selectedClassPair: selectedClassPair
      });
      
      console.log("Summarize response:", response.data);
      
      if (response.data.success) {
        // If server requests class pair selection, open modal
        if (response.data.needsSelection && response.data.classPairs && response.data.classPairs.length > 0) {
          console.log("Class pair selection needed, options:", response.data.classPairs);
          setAvailableClassPairs(response.data.classPairs);
          // Since modal is open, processing is not finished, user will select
          setProcessing(false);
          return;
        }
        // If no selection is required or result is returned
        if (response.data.imagePath) {
          const imagePath = response.data.imagePath;
          const timestamp = new Date().getTime();
          
          let determinedClassPair = selectedClassPair || response.data.analyzedClassPair;
          if (!determinedClassPair) {
            // If selectedClassPair is null and backend did not send analyzedClassPair, try to find the only class pair
            const differentialAnalysisClassPairs = [
              ...new Set(
                previousAnalyses
                  .filter(a => a.parameters && a.parameters.differential && a.parameters.differential.length > 0)
                  .map(a => {
                    if (a.parameters.selectedClasses && a.parameters.selectedClasses.length >= 2) {
                      return a.parameters.selectedClasses.join('_');
                    }
                    return null;
                  })
                  .filter(pair => pair !== null)
              )
            ];
            
            if (differentialAnalysisClassPairs.length === 1) {
              determinedClassPair = differentialAnalysisClassPairs[0];
            }
          }
          // If still no determinedClassPair, keep as "Summary" or show error
          determinedClassPair = determinedClassPair || "Summary";

          const newSummary = {
            classPair: determinedClassPair,
            imagePath: imagePath,
            timestamp: timestamp,
            version: imageVersion + 1,
            featureCount: selectedFeatureCount
          };

          // Keep only the most recent summary for a given class pair.
          // Whenever a new summary is generated for the same class pair (irrespective of the selected feature count),
          // remove the previous one so that only the latest user choice is displayed.
          setSummarizeAnalyses(prev => {
              // Filter out **all** summaries that belong to the same class pair
              const withoutCurrentPair = prev.filter(s => s.classPair !== newSummary.classPair);
              // Append the newly generated summary
              return [...withoutCurrentPair, newSummary];
          });

          setImageVersion(prev => prev + 1);
          setAvailableClassPairs([]);
      } else {
            setError(response.data.message || "Summarization successful, but no image path returned.");
      }
      } else {
        console.error("Summarization error response:", response.data);
        setError(response.data.message || 'Failed to summarize statistical methods.');
        setAvailableClassPairs([]);
      }
    } catch (error) {
      console.error("Error in handleSummarizeStatisticalMethods:", error);
      setError(error.response?.data?.message || 'An error occurred while trying to summarize statistical methods.');
      setAvailableClassPairs([]);
    } finally {
      setProcessing(false);
    }
  };

  // Final AdÄ±mÄ± Summarize: When a class pair is selected (from modal)
  const handleClassPairSelection = (classPair) => {
    setAvailableClassPairs([]); // Immediately close modal
    handleSummarizeStatisticalMethods(classPair); // Call again with selected pair
  };

  // Final AdÄ±mÄ± Summarize: Close class pair selection modal (X button)
  const handleCloseClassPairModal = () => {
    setAvailableClassPairs([]);
    // If closing modal cancels the process, you may set processing to false here.
    // setProcessing(false);
  };

  const handleOpenUserGuide = () => setShowUserGuide(true);
  const handleCloseUserGuide = () => setShowUserGuide(false);

  // Scroll to the selected step
  useEffect(() => {
    if (showStepAnalysis) {
      scrollToStep(stepAnalysisRef);
    } else if (analyzing) {
      scrollToStep(pageRef);
    }
  }, [showStepThree, showStepFour, showStepFive, selectedIllnessColumn, selectedSampleColumn, selectedClasses, showStepSix, showStepAnalysis, analyzing, scrollToStep]);
  
  // On page load or refresh, close class pair selection modal
  useEffect(() => {
    setAvailableClassPairs([]);
  }, []);

  // Show Step 7 (Run Analysis button): When Step 6 is visible and not analyzing
  useEffect(() => {
    console.log("[Effect Check Step 7 Visibility] showStepSix:", showStepSix, "analyzing:", analyzing);
    const shouldShow = showStepSix && !analyzing;
    if (shouldShow !== showStepAnalysis) {
        console.log(`[Effect Check Step 7 Visibility] Setting showStepAnalysis to ${shouldShow}`);
    }
    setShowStepAnalysis(shouldShow);
    if (shouldShow) {
      setTimeout(() => {
        if (stepAnalysisRef.current) scrollToStep(stepAnalysisRef);
      }, 100);
    }
  }, [showStepSix, analyzing, showStepAnalysis, scrollToStep]);

  // When analysis starts, scroll to top (or log/progress area)
  useEffect(() => {
    if (analyzing) {
      setTimeout(() => {
        if (pageRef.current) scrollToStep(pageRef); 
      }, 100);
    }
  }, [analyzing, scrollToStep]);

  return (
    <div>
      <header className="app-header">
        <img src={process.env.PUBLIC_URL + "/logo192.png"} alt="Logo" />
        <span>BIOMARKER ANALYSIS TOOL</span>
        <button className="user-guide-link" onClick={handleOpenUserGuide}>
          <span>User</span>
          <span>Guide</span>
        </button>
      </header>
      {/* Render User Guide Modal */}
      {showUserGuide && <UserGuideModal onClose={handleCloseUserGuide} />}
      {/* Step 1: Browse file*/}
      {showStepOne && (
      <div className="file-browse-section">
        {/* Step 1 */}
        <div className="step-and-instruction">
          <div className="step-number">1</div>
          <h2 className="title">Choose your file</h2>
        </div>
        <div className="file-input-container">
          <div className="file-selection-row">
            <button className="file-browse-button" onClick={handleBrowseClick}>
              Browse
            </button>
            
            <button 
              className="demo-file-button" 
              onClick={handleDemoFileClick}
              title="Try a sample analysis without uploading your own file"
              disabled={loading}
            >
              {loading && demoMode ? (
                <>
                  <div className="spinner"></div>
                  Loading Demo Dataset...
                </>
              ) : (
                "OR Use a Demo Dataset for Alzheimer's Disease"
              )}
            </button>
            
            <span id="file-name">
              {multiFiles.length > 1
                ? multiFiles.map(f => truncateFileName(f.name)).join(', ')
                : file ? truncateFileName(file.name) : 'No file chosen'}
            </span>
          </div>
          
          <div className="format-instructions-row">
            <button type="button" className="format-instructions-link" onClick={(e) => {
              // No default navigation for button, but keep preventDefault for safety
              e.preventDefault();
              handleOpenFormatPopup();
            }}>
              (Input file format instructions)
            </button>
          </div>
          
          <input
            id="fileInput"
            ref={fileInputRef} // Attach the ref here
            type="file"
            className="file-input-hidden"
            accept=".csv,.tsv,.txt,.xlsx,.gz,.zip"
            onChange={handleFileChange}
            multiple
          />
        </div>
      </div>
      )}
      
      {/* Step 1: Format popup */}
      {showFormatPopup && <InputFormatPopup onClose={handleCloseFormatPopup} />}
      
      {/* Step 2: Upload file */}
      {showStepTwo && (
      <div className="file-upload-section">
        {/* Step 2 */}
        <div className="step-and-instruction">
          <div className="step-number">2</div>
          <h2 className="title">Upload your file</h2>
        </div>

        
        {/* In demo mode, only show uploaded file info */}
        {step2UploadedSnapshot && !loading ? (
          <>
            {Array.isArray(step2UploadedSnapshot) ? (
              <div className="uploaded-info-list">
                {step2UploadedSnapshot.map((info, idx) => (
                  <div key={idx} className="uploaded-info">
                    Uploaded file: <b>{truncateFileName(info.name)}</b>
                    {info.size ? ` (${info.size})` : ''}
                    {Array.isArray(uploadDuration) && uploadDuration[idx] && (
                      <div className="upload-duration">Upload time: {uploadDuration[idx]}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="uploaded-info">
                Uploaded file: <b>{truncateFileName(step2UploadedSnapshot.name)}</b>
                {step2UploadedSnapshot.size ? ` (${step2UploadedSnapshot.size})` : ''}
                {uploadDuration && (
                  <div className="upload-duration">
                    {!mergeDuration && `Upload time: ${uploadDuration}`}
                    {mergeDuration && `Merge time: ${mergeDuration}`}
                  </div>
                )}
              </div>
            )}
          </>
        ) : demoMode ? (
          <>
            {info && (
              <div className="loading-message">
                {loading && <div className="spinner"></div>}
                {info}
              </div>
            )}
            <div className="uploaded-info">
              Using demo dataset: <strong>GSE120584_serum_norm_demo.csv</strong>
            </div>
          </>
        ) : (
          <>
            {info && <div className="loading-message">
              <div className="spinner"></div>
              {info}
            </div>}
            
            <button className="upload-button" onClick={handleUpload}>
              Upload
            </button>
            {uploading && (
              <div className="file-is-loading">
              <div className="spinner"></div>
              File is uploading...
            </div>
            )}
            {uploadedInfo && (
              <>
              <div className="uploaded-info">
                Uploaded file: <b>{truncateFileName(uploadedInfo.name)}</b> ({uploadedInfo.size})
              </div>
              {uploadDuration && (
                <div className="upload-duration">Upload time: {uploadDuration}</div>
              )}
            </>
            )}
            {error && <div className="error-message">{error}</div>}
          </>
        )}
        
        {info && (
          <div className="loading-message">
            {info}
            
            {loading && <div className="spinner"></div>}
          </div>
        )}
      </div>
      )}

      {/* step 3, step 4, step 5, step 6, step 7 */}
      {anotherAnalysis.map((id, index) => (
        <div key={id}>
          {/* Only show analysis options after the last analysis section */}
          {index === anotherAnalysis.length - 1 && (
            <>
              {/* Step 3: Select Columns using Buttons and Modal */}
              {showStepThree && (
                <div ref={stepThreeRef} className="select-class-section step-three-container">
                <div className="step-and-instruction">
                  <div className="step-number">3</div>
                  <h2 className="title">Select Columns for Patient Groups and Sample IDs</h2>
                </div>
                
                <div className="column-selection-area">

                  {/* NEW: left side file list */}
                  {Array.isArray(multiUploadedInfo) && multiUploadedInfo.length > 1 && (
                    <div className="uploaded-files-list" style={{ width: '350px', marginRight: '20px', float: 'left' }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px' }}>Uploaded files</div>
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {multiUploadedInfo.map((u, idx) => (
                          <li
                            key={u.filePath || idx}
                            onClick={() => handleSelectUploadedFile(idx)}
                            style={{
                              padding: '8px',
                              marginBottom: '6px',
                              cursor: 'pointer',
                              background: idx === activeUploadedIndex ? '#e6f2ff' : '#fff',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>{truncateFileName(u.name, 30)}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{u.size}</div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                              Patient Group: {chosenColumns[idx]?.illnessColumn || '?'} - Sample ID: {chosenColumns[idx]?.sampleColumn || '?'}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <button style={{ marginTop: '8px' }} class="file-browse-button" onClick={handleMergeAfterStep3} disabled={loading}>
                        {/* Class is selected just for css purposes */}
                        Merge Files
                      </button>
                    </div>
                  )}

                  {/* existing two column selectors (move or wrap so they appear to the right of the list) */}
                  <div style={{ marginLeft: Array.isArray(multiUploadedInfo) && multiUploadedInfo.length > 1 ? '60px' : '0' }}>
                    {/* wrap the two selectors in a horizontal flex container */}
                    <div className="column-select-pair" style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
                      <div className="column-select-block" style={{ flex: 1 }}>
                        <label>Patient Group Column:</label>
                        <SearchableColumnList
                          initialColumns={firstTenColumns}
                          allColumns={allColumns}
                          onSelect={handleIllnessColumnSelectionForFile}
                          selectedColumns={selectedIllnessColumn}
                          placeholder="Search Patient Group column..."
                          listHeight="150px"
                          isLoading={loadingAllColumns}
                          disabled={loadingAllColumns || loadingClasses}
                        />
                      </div>

                      <div className="column-select-block" style={{ flex: 1 }}>
                        <label>Sample ID Column:</label>
                        <SearchableColumnList
                          initialColumns={firstTenColumns}
                          allColumns={allColumns}
                          onSelect={handleSampleColumnSelectionForFile}
                          selectedColumns={selectedSampleColumn}
                          placeholder="Search Sample ID column..."
                          listHeight="150px"
                          isLoading={loadingAllColumns}
                          disabled={loadingAllColumns || loadingClasses}
                        />
                      </div>
                    </div>
                  </div>

                </div>
                  {info && <div className="info-message step-info">{info}</div>}
                  {error && <div className="error-message step-error">{error}</div>}
              </div>
              )}
              {/* Step 4: Get classes names */}
              {showStepFour && !previousAnalyses[index] && (
                <div ref={stepFourRef} className='select-class-section' style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div className="step-and-instruction">
                      <div className="step-number">4</div>
                      <h2 className='title'>Select Two Classes for Comparison</h2>
                    </div>
                    {/* Chart will appear below when classTable is populated */}
                  </div>

                  {/* NEW: Right-side list of Patient Group columns selected in Step 3 */}
                  <div style={{ width: '320px', marginLeft: '20px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>Patient Group columns (from Step 3)</div>
                    <SearchableColumnList
                      initialColumns={(Array.isArray(chosenColumns) ? chosenColumns.map(c => c.illnessColumn).filter(Boolean) : [])}
                      allColumns={Array.isArray(chosenColumns) ? chosenColumns.map(c => c.illnessColumn).filter(Boolean) : []}
                      onSelect={(col) => handleMergedIllnessColumnSelect(col)}
                      selectedColumns={selectedMergedIllnessColumn ? [selectedMergedIllnessColumn] : []}
                      placeholder="Choose merged Patient Group column..."
                      listHeight="200px"
                      isLoading={false}
                      disabled={loadingClasses || !uploadedInfo?.filePath}
                    />
                    {loadingClasses && <div style={{ marginTop: 8 }}><div className="spinner"></div> Loading classes...</div>}
                  </div>
                </div>
              )}
              {/* Step 4: Class Table */}
              {classTable.class && Array.isArray(classTable.class) && showStepFour && !previousAnalyses[index] && classTable.class.length > 0 && (
                <BarChartWithSelection
                  chartUrl={buildUrl(`/${classTable.classDiagramUrl}`)}
                  classList={classTable.class}
                  onClassSelection={handleClassSelection}
                />
              )}
              
              {/* Step 4: Panel displaying selected classes - shown after the chart */}
              {showStepFour && !previousAnalyses[index] && selectedClasses && selectedClasses.length > 0 && (
                <div className="selected-classes-display">
                  <h3>Selected Classes:</h3>
                  <div className="selected-classes-list">
                    {selectedClasses.map((className, index) => (
                      <div key={index} className="selected-class-item">
                        <span className="selected-class-name">{className}</span>
                        <span className="selected-badge">selected</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Step 5: Select analysis method*/}
              {showStepFive && !previousAnalyses[index] && (
                <div ref={stepFiveRef} className='select-analysis-section'>
                {selectedClasses.length > 0 && (
                  <div className="step-and-instruction">
                    <div className="step-number">5</div>
                    <h1 className='title'>Choose an analysis method</h1>
                  </div>
                )}
                {selectedClasses.length > 0 && (
                  <AnalysisSelection onAnalysisSelection={handleAnalysisSelection} />
                )}
              </div>
              )}
              {/* Step 6: Choose Non-Feature Columns */}
              {showStepSix && (
                <div ref={stepSixRef} className="step-container step-six-container">
                  <div className="step-and-instruction-step6">
                    <div className="step-number">6</div>
                    <h1 className="title">Exclude Non-Feature Columns (Optional)</h1>
                  </div>
                  
                  <div className="non-feature-selection-area">
                    {info && <div className="info-message-step6">{info}</div>}
                    {/* Display selected columns with remove buttons */}
                    {nonFeatureColumns.length > 0 && (
                      <div className="selected-non-features-container">
                        <span className="selected-label">Excluded Columns:</span>
                        {nonFeatureColumns.map((col, idx) => (
                          <span key={idx} className="non-feature-tag">
                            {truncateFileName(col, 25)}
                            <button
                              className="non-feature-tag-remove"
                              onClick={() => handleRemoveNonFeatureColumn(col)}
                              aria-label={`Remove ${col}`}
                              title={`Remove ${col}`}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Column Selection List */}
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Select columns to exclude:</label>
                    <SearchableColumnList
                        initialColumns={firstTenColumns}
                        allColumns={allColumns}
                        onSelect={handleAddNonFeatureColumn}
                        selectedColumns={nonFeatureColumns}
                        placeholder="Search columns to exclude..."
                        listHeight="200px"
                        isLoading={loadingAllColumns}
                        disabled={loadingAllColumns || loadingClasses}
                    />
                  </div>
                  {error && <div className="error-message step-error">{error}</div>}
                </div>
              )}
              {/* Step 7: Run Analysis */}
              {showStepAnalysis && (
                <div ref={stepAnalysisRef} className="run-analysis-section">
                  <button className="run-analysis-button" onClick={handleStartAnalysis}>
                    Run Analysis
                  </button>
                </div>
              )}
              {analyzing && (
                <div className="analysis-running">
                  <div className="spinner"></div>
                  Analysis is running...
                </div>
              )}
            </>
          )}
          {/* Display previous analysis results */}
          {previousAnalyses[index] && (
            <>
              <div className="show-analysis-results">
                {analysisInformation[index] && (
                  <>
                  {(() => {
                    const sameFileAndClasses = index > 0 && 
                      analysisInformation[index].filePath === analysisInformation[0].filePath && 
                      analysisInformation[index].selectedClasses[0] === analysisInformation[0].selectedClasses[0] && 
                      analysisInformation[index].selectedClasses[1] === analysisInformation[0].selectedClasses[1];
                    
                    return (
                      <>
                      {/* A separate box will now be displayed for each analysis */}
                      <div className="analysis-information" style={{ margin: '0 auto', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h2 className="analysis-title" style={{ textAlign: 'center' }}>Analysis {index + 1} Details</h2>
                        
                        <div className="execution-time-container" style={{ textAlign: 'center', fontSize: '13px', color: '#555', margin: '5px 0 15px 0' }}>
                          Execution Time: {previousAnalyses[index].time || "N/A"}
                        </div>

                        <div className="analysis-details" style={{ width: '100%' }}>
                          {/* File and class information, only shown in the first analysis or when different files/classes are used */}
                          {!sameFileAndClasses && (
                            <>
                              <div className="analysis-detail">
                                <span className="detail-label">Analyzed File:</span>
                                <span className="detail-value">
                                  {(() => {
                                    const fullName = analysisInformation[index].filePath?.split('/').pop() || 'N/A';
                                    // If the filename contains a UUID prefix (36 chars + underscore), strip it.
                                    const firstUnderscore = fullName.indexOf('_');
                                    return firstUnderscore > 0 ? fullName.substring(firstUnderscore + 1) : fullName;
                                  })()}
                                </span>
                              </div>
                              <div className="analysis-detail">
                                <span className="detail-label">Analyzed Classes:</span>
                                <span className="detail-value">
                                  {analysisInformation[index].selectedClasses?.join(' vs ') || "N/A"}
                                </span>
                              </div>
                            </>
                          )}
                          <div className="analysis-detail">
                            <span className="detail-label">Analysis Method:</span>
                            <span className="detail-value">
                              {analysisInformation[index].differential?.length > 0 && `Differential: ${analysisInformation[index].differential.join(', ')}`}
                              {analysisInformation[index].clustering?.length > 0 && ` Clustering: ${analysisInformation[index].clustering.join(', ')}`}
                              {analysisInformation[index].classification?.length > 0 && ` Classification: ${analysisInformation[index].classification.join(', ')}`}
                            </span>
                          </div>
                          <div className="analysis-detail">
                            <span className="detail-label">Analysis Date:</span>
                            <span className="detail-value">
                              {previousAnalyses[index].date || "Not Available"}
                            </span>
                          </div>
                        </div>
                      </div>
                      </>
                    );
                  })()}
                  </>
                )}

                {/* Parameter Table - shown for each analysis */}
                <div className="parameters-table-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 auto', maxWidth: '1200px' }}>
                  <h3 className="parameters-table-title">Analysis Parameters</h3>
                  
                  <div className="parameters-table-wrapper" style={{ width: '100%', overflowX: 'auto' }}>
                    <table className="parameters-horizontal-table">
                      <thead>
                        <tr>
                          {/* Dynamically generate headers */}
                          {analysisInformation[index].differential?.length > 0 && (
                              <><th>Feature Type</th><th>Ref Class</th><th>LIME Samples</th><th>SHAP Finetune</th><th>LIME Finetune</th><th>Scoring</th><th>Feat.Importance Finetune</th><th>Top Features</th></>
                          )}
                          {analysisInformation[index].clustering?.length > 0 && (
                              <><th>Plotter</th><th>Dimension</th></>
                          )}
                          {analysisInformation[index].classification?.length > 0 && (
                              <><th>Param Finetune</th><th>Finetune Frac</th><th>Save Model</th><th>Std Scaling</th><th>Save Transformer</th><th>Save Encoder</th><th>Verbose</th></>
                          )}
                          {/* Common */}
                          <th>Test Size</th><th>N Folds</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {/* Dynamically insert values */}
                          {analysisInformation[index].differential?.length > 0 && (
                            <>
                              <td>{analysisInformation[index].featureType}</td>
                                  <td>{analysisInformation[index].referenceClass || "Auto"}</td>
                              <td>{analysisInformation[index].limeGlobalExplanationSampleNum}</td>
                                  <td className={analysisInformation[index].shapModelFinetune ? "boolean-true" : "boolean-false"}>{String(analysisInformation[index].shapModelFinetune)}</td>
                                  <td className={analysisInformation[index].limeModelFinetune ? "boolean-true" : "boolean-false"}>{String(analysisInformation[index].limeModelFinetune)}</td>
                              <td>{analysisInformation[index].scoring}</td>
                                  <td className={analysisInformation[index].featureImportanceFinetune ? "boolean-true" : "boolean-false"}>{String(analysisInformation[index].featureImportanceFinetune)}</td>
                              <td>{analysisInformation[index].numTopFeatures}</td>
                            </>
                          )}
                          {analysisInformation[index].clustering?.length > 0 && (
                               <><td>{analysisInformation[index].plotter}</td><td>{analysisInformation[index].dim}</td></>
                          )}
                          {analysisInformation[index].classification?.length > 0 && (
                              <>
                                  <td className={analysisInformation[index].paramFinetune ? "boolean-true" : "boolean-false"}>{String(analysisInformation[index].paramFinetune)}</td>
                              <td>{analysisInformation[index].finetuneFraction}</td>
                                  <td className={analysisInformation[index].saveBestModel ? "boolean-true" : "boolean-false"}>{String(analysisInformation[index].saveBestModel)}</td>
                                  <td className={analysisInformation[index].standardScaling ? "boolean-true" : "boolean-false"}>{String(analysisInformation[index].standardScaling)}</td>
                                  <td className={analysisInformation[index].saveDataTransformer ? "boolean-true" : "boolean-false"}>{String(analysisInformation[index].saveDataTransformer)}</td>
                                  <td className={analysisInformation[index].verbose ? "boolean-true" : "boolean-false"}>{String(analysisInformation[index].verbose)}</td>
                            </>
                          )}
                          {/* Common */}
                          <td>{analysisInformation[index].testSize}</td><td>{analysisInformation[index].nFolds}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Analysis Results - moved below the parameter table */}
                <div className="result-block-container" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '1200px' }}>
                  {previousAnalyses[index].results.map((imagePath, imgIndex) => {
                    // Extract file name and add more detailed logging
                    console.log("imagePath: ", imagePath);
                    const rawImageName = imagePath.split('/').pop(); // Get the full file name
                    
                    let imageName = rawImageName
                      .replace(/_/g, ' ') // Replace '_' characters with space
                      .replace('.png', ''); // Remove '.png' extension
                    
                    // Capitalize the first letter of the word "results"
                    imageName = imageName.replace(/\bresults\b/i, 'Results')
                      .replace(/Model Evaluation Results -\s*/i, '')
                      .replace(/Classification Results -\s*/i, '')
                      .replace(/Clustering Results -\s*/i, '')
                      .replace(/Analysis Results -\s*/i, '')
                      .replace(/Performance Results -\s*/i, '')
                      .replace(/Differential Analysis -\s*/i, '')
                      .trim();
                    
                    // More comprehensive control - for graphs after feature selection
                    // Check both in the path and in the file name
                    const isAfterFeatureSelection = 
                      imagePath.includes('AfterFeatureSelection') || 
                      imagePath.includes('afterFeatureSelection');
                    
                    console.log("isAfterFeatureSelection: ", isAfterFeatureSelection);
                    
                    // To find charts of the same analysis type (e.g., PCA)
                    const baseName = rawImageName.replace(/AfterFeatureSelection|afterFeatureSelection/g, '')
                      .replace(/initial_|initial/g, '')
                      .replace(/initial\/|AfterFeatureSelection\//g, '')
                      .trim();
                    
                    // Find all graphs of the same graphic type (e.g., all PCA graphs)
                    const sameTypeGraphs = previousAnalyses[index].results.filter(path => 
                      path.includes(baseName) || path.endsWith(baseName)
                    );
                                        
                    // Advanced logic: decide based on ordering if there are multiple graphs of the same type
                    if (sameTypeGraphs.length > 1) {
                      // Find the index of this graph among all graphs of the same type
                      const currentGraphIndex = sameTypeGraphs.indexOf(imagePath);
                      
                      // According to odd/even ordering:
                      // Typically, the first graph is with all features and the second with selected features
                      if (currentGraphIndex > 0) {
                        // Second or subsequent graph - with selected features
                        const topFeaturesCount = analysisInformation[index]?.numTopFeatures || 20;
                        imageName = `${imageName} (Selected Top-${topFeaturesCount} Features)`;
                      } else {
                        // First graph - with all features
                        imageName = `${imageName} (All Features)`;
                      }
                    } else if (isAfterFeatureSelection) {
                      // Continue with classic method - based on file path
                      const topFeaturesCount = analysisInformation[index]?.numTopFeatures || 20;
                      let cleanedName = imageName
                        .replace('afterFeatureSelection', '')
                        .replace('AfterFeatureSelection', '')
                        .trim();
                      imageName = `${cleanedName} (Selected Top-${topFeaturesCount} Features)`;
                      console.log("Path control applied to Selected Features title:", imageName);
                    } else {
                      // If the graph is single and not in a special case, assume all features
                      imageName = `${imageName} (All Features)`;
                      console.log("Default All Features title applied:", imageName);
                    }

                    return (
                      <div key={`${index}-${imgIndex}`} className="result-block" style={{ margin: '10px', display: 'flex', justifyContent: 'center' }}>
                        {/* ImagePopup Component */}
                        <ImagePopup 
                          imagePath = {buildUrl(`/${imagePath}`)}
                          imageName = {imageName}
                        />
                      </div>
                    );
                  })}
                </div>

              </div>
              {/* Perform Another Analysis */}
              {index === anotherAnalysis.length - 1 && (          
                <div className="post-analysis-options">
                  {/* "Perform Another Analysis on Your Dataset" button */}
                  <button
                    className="button perform-analysis"
                    onClick={handlePerformAnotherAnalysis}
                  >
                    Perform Another Analysis on Your Dataset
                  </button>
                  {/* OR text centered */}
                  <div className="or-container">
                    <h1 className="or-text">OR</h1>
                  </div>
                  <button className="button start-over" onClick={handleStartOver}>
                    Start Over with a New Dataset
                  </button>
                  {/* Newly added OR delimiter */}
                  <div className="or-container">
                    <h1 className="or-text">OR</h1>
                  </div>
                  <div className="feature-count-selector">
                    <label htmlFor="featureCount">Number of most influential Biomarkers to display: </label>
                    <select 
                      id="featureCount" 
                      value={selectedFeatureCount} 
                      onChange={(e) => setSelectedFeatureCount(Number(e.target.value))}
                      className="feature-count-dropdown"
                    >
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(count => (
                        <option key={count} value={count}>{count}</option>
                      ))}
                    </select>
                  </div>
                  {/* Area added for error messages */}
                  {error && previousAnalyses.length > 0 && !processing && (
                    <div className="error-message" style={{textAlign: 'center', marginBottom: '10px'}}>{error}</div>
                  )}
                  <button 
                    className="button summarize-statistical-methods" 
                    onClick={() => handleSummarizeStatisticalMethods()}
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Combine the above biomarker list in to one list'}
                  </button>
                  
                  {/* Class pair selection modal */}
                  {availableClassPairs.length > 0 && (
                    <div className="class-pair-selection-modal">
                      <div className="class-pair-selection-content">
                        <button className="close-modal-button" onClick={handleCloseClassPairModal}>Ã—</button>
                        <h3>Select Class Pair for Summary</h3>
                        <p>Multiple class pairs detected. Please select which one to analyze:</p>
                        <div className="class-pair-list">
                          {availableClassPairs.map(classPair => (
                            <button 
                              key={classPair} 
                              className="button class-pair-button"
                              onClick={() => handleClassPairSelection(classPair)}
                              disabled={processing}
                            >
                              {classPair.split('_').join(' vs ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summarize Analyses */}
                  {summarizeAnalyses.length > 0 && (
                  <div className="summarize-analyses-container">
                    {summarizeAnalyses.map((summary, idx) => (
                      <div key={`${summary.timestamp}-${idx}`} className="summary-analysis-block">
                        <h3 className="class-pair-title">
                            Summary for: {summary.classPair.split('_').join(' vs ')} (Top-{summary.featureCount} Features)
                        </h3>
                        <div className="summary-image-container">
                          <ImagePopup 
                            key={`summary-image-${summary.timestamp}-${summary.version}`}
                            imagePath={buildUrl(`/${summary.imagePath}?t=${summary.timestamp}&v=${summary.version}`)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                  {/* Analysis Report - always visible */}
                  <AnalysisReport
                    analysisResults={previousAnalyses.map((analysis, idx) => {
                      const analysisParams = analysis.parameters; // Parameters specific to each analysis (payload)

                      const images = analysis.results.map((imagePath, imgIdx) => {
                        const rawImageName = imagePath.split('/').pop();
                        let imageName = rawImageName
                          .replace(/_/g, ' ')
                          .replace('.png', '')
                          .replace(/\bresults\b/i, 'Results')
                          .replace(/Model Evaluation Results -\s*/i, '')
                          .replace(/Classification Results -\s*/i, '')
                          .replace(/Clustering Results -\s*/i, '')
                          .replace(/Analysis Results -\s*/i, '')
                          .replace(/Performance Results -\s*/i, '')
                          .replace(/Differential Analysis -\s*/i, '')
                          .trim();
                        
                        const isAfterFeatureSelection = 
                          imagePath.includes('AfterFeatureSelection') || 
                          imagePath.includes('afterFeatureSelection');
                        
                        if (isAfterFeatureSelection) {
                          // Use numTopFeatures from analysisParams (i.e., the payload of that analysis)
                          const topFeaturesCount = analysisParams?.numTopFeatures || 20;
                          imageName = `${imageName} (Selected Top-${topFeaturesCount} Features)`;
                        } else if (imagePath.includes('initial')) {
                          imageName = `${imageName} (All Features)`;
                        }
                        
                        return {
                          id: `analysis-${idx}-image-${imgIdx}`,
                          path: buildUrl(`/${imagePath}`),
                          caption: imageName
                        };
                      });

                      return {
                        title: `Analysis ${idx + 1}`, // Analysis title
                        images: images, // Images and captions belonging to the analysis
                        classPair: analysisParams.selectedClasses ? analysisParams.selectedClasses.join(' vs ') : 'N/A',
                        date: analysis.date, // Analysis's own date
                        time: analysis.time, // Analysis's own time
                        types: { // Analysis's own types
                          differential: analysisParams.differential || [],
                          clustering: analysisParams.clustering || [],
                          classification: analysisParams.classification || []
                        },
                        parameters: analysisParams // All other parameters that might be needed in the report
                      };
                    })}
                    analysisDate={previousAnalyses[index]?.date || new Date().toLocaleDateString()}
                    executionTime={previousAnalyses[index]?.time}
                    selectedClasses={selectedClasses}
                    selectedIllnessColumn={selectedIllnessColumn}
                    selectedAnalyzes={selectedAnalyzes}
                    featureCount={selectedFeatureCount}
                    selectedClassPair={summarizeAnalyses.length > 0 ? summarizeAnalyses[summarizeAnalyses.length - 1].classPair : null}
                    summaryImagePath={summarizeAnalyses.length > 0 ? summarizeAnalyses[summarizeAnalyses.length - 1].imagePath : null}
                    summarizeAnalyses={summarizeAnalyses.map(analysis => ({
                      classPair: analysis.classPair ? analysis.classPair.split('_').join(' vs ') : 'All Classes',
                      imagePath: buildUrl(`/${analysis.imagePath}?t=${analysis.timestamp}&v=${analysis.version}`)
                    }))}
                    datasetFileName={uploadedInfo?.name || 'Unknown File'}
                  />
                </div>
              )}
            </>
          )}
        </div>
      ))}

    </div>
  );
}

export default App;