const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OptimizedATSAnalyzer = require('../utils/optimizedATSAnalyzer');
const EnhancedResumeParser = require('../utils/enhancedResumeParser');
const progressTracker = require('../utils/progressTracker');

const router = express.Router();
const analyzer = new OptimizedATSAnalyzer();
const resumeParser = new EnhancedResumeParser();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/ats');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.html'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, DOC, TXT, and HTML files are allowed.'));
    }
  }
});

// Optimized ATS Analysis endpoint
router.post('/analyze', upload.single('resume'), async (req, res) => {
  const startTime = Date.now();
  const timeout = 60000; // Reduced to 1 minute timeout
  const sessionId = req.body.sessionId || `ats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Set response timeout
  res.setTimeout(timeout, () => {
    if (!res.headersSent) {
      errorProgress(sessionId, { message: 'Analysis timeout - please try fast mode' });
      res.status(408).json({
        success: false,
        error: 'Analysis timeout - please try fast mode',
        suggestion: 'Use /analyze/fast endpoint for quicker results'
      });
    }
  });
  
  try {
    console.log('🚀 Starting optimized ATS analysis...');
    progressTracker.initializeProgress(sessionId);
    progressTracker.updateProgress(sessionId, 0, 'Resume file uploaded successfully');
    
    if (!req.file) {
      progressTracker.errorProgress(sessionId, { message: 'No resume file uploaded' });
      return res.status(400).json({
        success: false,
        error: 'No resume file uploaded'
      });
    }

    const { 
      industry = 'technology', 
      role = 'Senior',
      mode = 'comprehensive' // 'fast' or 'comprehensive'
    } = req.body;
    
    console.log(`📄 Processing file: ${req.file.originalname}`);
    console.log(`🎯 Target: ${role} ${industry}`);
    console.log(`⚡ Mode: ${mode}`);
    progressTracker.updateProgress(sessionId, 1, `Extracting text from ${req.file.originalname}...`);

    // Parse the resume using EnhancedResumeParser
    const parseResult = await resumeParser.parseResume(req.file.path, req.file.mimetype);
    
    if (!parseResult.success) {
      progressTracker.errorProgress(sessionId, { message: parseResult.error || 'Failed to parse resume' });
      return res.status(400).json({
        success: false,
        error: parseResult.error || 'Failed to parse resume'
      });
    }
    
    if (!parseResult.text || parseResult.text.trim().length === 0) {
      progressTracker.errorProgress(sessionId, { message: 'No text content found in the uploaded file' });
      return res.status(400).json({
        success: false,
        error: 'No text content found in the uploaded file'
      });
    }

    // Prepare resume data for analysis
    const resumeData = {
      text: parseResult.text,
      fileName: parseResult.fileName,
      fileSize: parseResult.fileSize,
      parsedAt: parseResult.parsedAt
    };

    console.log(`📝 Extracted text length: ${resumeData.text.length} characters`);
    progressTracker.updateProgress(sessionId, 1, `Successfully extracted ${resumeData.text.length} characters from resume`);
    
    // Analyze with optimized ATS analyzer
    const analysisMode = mode === 'fast' ? 'Fast' : 'Comprehensive';
    progressTracker.updateProgress(sessionId, 2, `Running ${analysisMode} AI analysis...`);
    
    const analysisOptions = {
      sessionId: sessionId,
      fastMode: mode === 'fast'
    };
    
    const analysis = await analyzer.analyzeResume(resumeData, industry, role, analysisOptions);

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
      console.log('🗑️ Cleaned up uploaded file');
    } catch (cleanupError) {
      console.warn('⚠️ Could not delete uploaded file:', cleanupError.message);
    }

    progressTracker.updateProgress(sessionId, 3, 'Finalizing analysis results...');

    // Transform the analysis result to match frontend expectations
    const transformedResult = {
      overallScore: analysis.atsScore || 0,
      keywordScore: analysis.detailedMetrics?.keywordDensity || 0,
      formatScore: analysis.detailedMetrics?.formatConsistency || 0,
      structureScore: analysis.detailedMetrics?.sectionCompleteness || 0,
      issues: [
        ...(analysis.weaknesses || []).map(weakness => ({
          type: 'warning',
          message: weakness,
          suggestion: 'Consider addressing this area for improvement'
        })),
        ...(analysis.strengths || []).map(strength => ({
          type: 'info',
          message: strength,
          suggestion: 'This is a strong point in your resume'
        }))
      ],
      keywords: {
        found: [], // Will be populated from detailedInsights if available
        missing: [], // Will be populated from detailedInsights if available
        suggested: [] // Will be populated from detailedInsights if available
      },
      recommendations: analysis.recommendations || [],
      // Additional data from the analyzer
      overallGrade: analysis.overallGrade,
      detailedMetrics: analysis.detailedMetrics,
      quickStats: analysis.quickStats,
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      detailedInsights: analysis.detailedInsights,
      industryAlignment: analysis.industryAlignment,
      contentQuality: analysis.contentQuality,
      industryBenchmark: analysis.industryBenchmark,
      // Performance data
      analysisTime: analysis.analysisTime,
      analysisMode: analysis.analysisMode,
      modelsUsed: analysis.modelsUsed,
      cached: analysis.cached
    };

    // Complete the progress
    progressTracker.completeProgress(sessionId, transformedResult);

    const totalTime = Date.now() - startTime;
    console.log(`✅ Optimized analysis completed in ${totalTime}ms`);

    res.json({
      success: true,
      data: transformedResult,
      sessionId: sessionId,
      performance: {
        totalTime: totalTime,
        analysisTime: analysis.analysisTime,
        mode: analysis.analysisMode,
        cached: analysis.cached
      }
    });

  } catch (error) {
    console.error('❌ Optimized ATS analysis error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ Could not delete uploaded file after error:', cleanupError.message);
      }
    }

    // Send error progress
    progressTracker.errorProgress(sessionId, error);

    res.status(500).json({
      success: false,
      error: error.message || 'Analysis failed'
    });
  }
});

// Fast analysis endpoint
router.post('/analyze/fast', upload.single('resume'), async (req, res) => {
  const startTime = Date.now();
  const timeout = 30000; // 30 seconds timeout for fast mode
  const sessionId = req.body.sessionId || `ats-fast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Set response timeout
  res.setTimeout(timeout, () => {
    if (!res.headersSent) {
      errorProgress(sessionId, { message: 'Fast analysis timeout' });
      res.status(408).json({
        success: false,
        error: 'Fast analysis timeout'
      });
    }
  });
  
  try {
    console.log('⚡ Starting fast ATS analysis...');
    progressTracker.initializeProgress(sessionId);
    progressTracker.updateProgress(sessionId, 0, 'Resume file uploaded successfully');
    
    if (!req.file) {
      progressTracker.errorProgress(sessionId, { message: 'No resume file uploaded' });
      return res.status(400).json({
        success: false,
        error: 'No resume file uploaded'
      });
    }

    const { industry = 'technology', role = 'Senior' } = req.body;
    
    console.log(`📄 Processing file: ${req.file.originalname}`);
    console.log(`🎯 Target: ${role} ${industry}`);
    progressTracker.updateProgress(sessionId, 1, `Extracting text from ${req.file.originalname}...`);

    // Parse the resume
    const parseResult = await resumeParser.parseResume(req.file.path, req.file.mimetype);
    
    if (!parseResult.success) {
      progressTracker.errorProgress(sessionId, { message: parseResult.error || 'Failed to parse resume' });
      return res.status(400).json({
        success: false,
        error: parseResult.error || 'Failed to parse resume'
      });
    }
    
    if (!parseResult.text || parseResult.text.trim().length === 0) {
      progressTracker.errorProgress(sessionId, { message: 'No text content found in the uploaded file' });
      return res.status(400).json({
        success: false,
        error: 'No text content found in the uploaded file'
      });
    }

    // Prepare resume data
    const resumeData = {
      text: parseResult.text,
      fileName: parseResult.fileName,
      fileSize: parseResult.fileSize,
      parsedAt: parseResult.parsedAt
    };

    console.log(`📝 Extracted text length: ${resumeData.text.length} characters`);
    progressTracker.updateProgress(sessionId, 1, `Successfully extracted ${resumeData.text.length} characters from resume`);
    
    // Fast analysis
    progressTracker.updateProgress(sessionId, 2, 'Running fast AI analysis...');
    
    const analysisOptions = {
      sessionId: sessionId,
      fastMode: true
    };
    
    const analysis = await analyzer.analyzeResume(resumeData, industry, role, analysisOptions);

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
      console.log('🗑️ Cleaned up uploaded file');
    } catch (cleanupError) {
      console.warn('⚠️ Could not delete uploaded file:', cleanupError.message);
    }

    progressTracker.updateProgress(sessionId, 3, 'Finalizing fast analysis results...');

    // Transform the analysis result
    const transformedResult = {
      overallScore: analysis.atsScore || 0,
      keywordScore: analysis.detailedMetrics?.keywordDensity || 0,
      formatScore: analysis.detailedMetrics?.formatConsistency || 0,
      structureScore: analysis.detailedMetrics?.sectionCompleteness || 0,
      issues: [
        ...(analysis.weaknesses || []).map(weakness => ({
          type: 'warning',
          message: weakness,
          suggestion: 'Consider addressing this area for improvement'
        })),
        ...(analysis.strengths || []).map(strength => ({
          type: 'info',
          message: strength,
          suggestion: 'This is a strong point in your resume'
        }))
      ],
      keywords: {
        found: [],
        missing: [],
        suggested: []
      },
      recommendations: analysis.recommendations || [],
      overallGrade: analysis.overallGrade,
      detailedMetrics: analysis.detailedMetrics,
      quickStats: analysis.quickStats,
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      detailedInsights: analysis.detailedInsights,
      industryAlignment: analysis.industryAlignment,
      contentQuality: analysis.contentQuality,
      industryBenchmark: analysis.industryBenchmark,
      analysisTime: analysis.analysisTime,
      analysisMode: analysis.analysisMode,
      modelsUsed: analysis.modelsUsed,
      cached: analysis.cached
    };

    // Complete the progress
    progressTracker.completeProgress(sessionId, transformedResult);

    const totalTime = Date.now() - startTime;
    console.log(`⚡ Fast analysis completed in ${totalTime}ms`);

    res.json({
      success: true,
      data: transformedResult,
      sessionId: sessionId,
      performance: {
        totalTime: totalTime,
        analysisTime: analysis.analysisTime,
        mode: analysis.analysisMode,
        cached: analysis.cached
      }
    });

  } catch (error) {
    console.error('❌ Fast ATS analysis error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ Could not delete uploaded file after error:', cleanupError.message);
      }
    }

    // Send error progress
    progressTracker.errorProgress(sessionId, error);

    res.status(500).json({
      success: false,
      error: error.message || 'Fast analysis failed'
    });
  }
});

// Cache management endpoints
router.get('/cache/stats', (req, res) => {
  try {
    const stats = analyzer.getCacheStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/cache/clear', (req, res) => {
  try {
    analyzer.clearCache();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Optimized ATS analyzer is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: [
      'Fast analysis mode',
      'Comprehensive analysis mode',
      'Response caching',
      'Request timeout handling',
      'Performance monitoring'
    ]
  });
});

module.exports = router;