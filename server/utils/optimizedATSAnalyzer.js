const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const IndustryBenchmarks = require('./industryBenchmarks');
const DynamicKeywordService = require('./dynamicKeywordService');
const EnhancedResumeParser = require('./enhancedResumeParser');
const crypto = require('crypto');

class OptimizedATSAnalyzer {
  constructor() {
    // Initialize AI clients
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Initialize services
    this.benchmarks = new IndustryBenchmarks();
    this.keywordService = new DynamicKeywordService();
    this.parser = new EnhancedResumeParser();
    
    // Performance optimizations
    this.cache = new Map(); // Simple in-memory cache
    this.requestQueue = []; // Request queuing
    this.isProcessing = false;
    
    // Configuration
    this.config = {
      cacheTimeout: 3600000, // 1 hour
      maxCacheSize: 1000,
      requestTimeout: 30000, // 30 seconds per AI model
      enableParallelProcessing: true,
      enableCaching: true,
      enableFastMode: true
    };
  }

  /**
   * Main analysis method with performance optimizations
   */
  async analyzeResume(resumeData, targetIndustry = 'technology', targetRole = 'Senior', options = {}) {
    const startTime = Date.now();
    const sessionId = options.sessionId || `ats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('🚀 Starting optimized ATS analysis...');
      
      // Check cache first
      const cacheKey = this.generateCacheKey(resumeData, targetIndustry, targetRole);
      if (this.config.enableCaching && this.cache.has(cacheKey)) {
        const cachedResult = this.cache.get(cacheKey);
        if (Date.now() - cachedResult.timestamp < this.config.cacheTimeout) {
          console.log('✅ Returning cached analysis result');
          return {
            ...cachedResult.data,
            cached: true,
            analysisTime: Date.now() - startTime
          };
        } else {
          this.cache.delete(cacheKey);
        }
      }

      let resumeText = resumeData.text || resumeData.rawText || '';
      
      // Parse file if needed
      if (!resumeText.trim() && resumeData.filePath) {
        console.log('📄 Parsing resume file...');
        const parseResult = await this.parser.parseResume(resumeData.filePath, resumeData.mimeType);
        
        if (parseResult.success) {
          resumeText = parseResult.text;
          console.log(`✅ File parsed successfully (${parseResult.parsingMethod})`);
        } else {
          throw new Error(`File parsing failed: ${parseResult.error}`);
        }
      }
      
      if (!resumeText.trim()) {
        throw new Error('No resume text found');
      }

      // Get keywords (cached)
      const industryKeywords = await this.getCachedKeywords(targetIndustry, targetRole);
      console.log(`📋 Using ${industryKeywords.length} keywords for ${targetIndustry} ${targetRole}`);
      
      // Choose analysis strategy based on options
      let analysis;
      if (options.fastMode || this.config.enableFastMode) {
        analysis = await this.performFastAnalysis(resumeText, targetIndustry, targetRole, industryKeywords);
      } else {
        analysis = await this.performComprehensiveAnalysis(resumeText, targetIndustry, targetRole, industryKeywords);
      }

      // Add industry benchmarking
      const benchmarkData = this.benchmarks.compareWithBenchmark(analysis, targetIndustry, targetRole);
      analysis.industryBenchmark = benchmarkData;
      
      // Cache the result
      if (this.config.enableCaching) {
        this.cacheResult(cacheKey, analysis);
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ Optimized analysis completed in ${totalTime}ms`);
      
      return {
        ...analysis,
        analysisTime: totalTime,
        cached: false
      };

    } catch (error) {
      console.error('❌ Optimized ATS analysis failed:', error);
      throw error;
    }
  }

  /**
   * Fast analysis mode - uses single AI model with optimized prompt
   */
  async performFastAnalysis(resumeText, targetIndustry, targetRole, industryKeywords) {
    console.log('⚡ Running fast analysis mode...');
    
    const startTime = Date.now();
    
    try {
      // Use optimized prompt for faster processing
      const fastPrompt = this.createFastAnalysisPrompt(resumeText, targetIndustry, targetRole, industryKeywords);
      
      // Use only the faster AI model (GPT-4o with reduced tokens)
      const analysis = await this.getFastGPT4oAnalysis(fastPrompt);
      
      const duration = Date.now() - startTime;
      console.log(`⚡ Fast analysis completed in ${duration}ms`);
      
      return {
        ...analysis,
        modelsUsed: ['GPT-4o (Fast Mode)'],
        analysisMode: 'fast'
      };
      
    } catch (error) {
      console.error('❌ Fast analysis failed:', error);
      // Fallback to basic analysis
      return this.getFallbackAnalysis(targetIndustry, targetRole);
    }
  }

  /**
   * Comprehensive analysis mode - uses both AI models with full analysis
   */
  async performComprehensiveAnalysis(resumeText, targetIndustry, targetRole, industryKeywords) {
    console.log('🔍 Running comprehensive analysis mode...');
    
    const startTime = Date.now();
    
    try {
      const analysisPrompt = this.createAnalysisPrompt(resumeText, targetIndustry, targetRole, industryKeywords);
      
      // Run both analyses in parallel with timeout
      const [claudeAnalysis, gpt4oAnalysis] = await Promise.allSettled([
        this.getClaudeSonnetAnalysisWithTimeout(analysisPrompt),
        this.getGPT4oAnalysisWithTimeout(analysisPrompt)
      ]);

      const claudeResult = claudeAnalysis.status === 'fulfilled' ? claudeAnalysis.value : null;
      const gpt4oResult = gpt4oAnalysis.status === 'fulfilled' ? gpt4oAnalysis.value : null;

      // Combine results
      const combinedAnalysis = this.combineAnalysisResults(claudeResult, gpt4oResult, targetIndustry, targetRole);
      
      const duration = Date.now() - startTime;
      console.log(`🔍 Comprehensive analysis completed in ${duration}ms`);
      
      return {
        ...combinedAnalysis,
        analysisMode: 'comprehensive'
      };
      
    } catch (error) {
      console.error('❌ Comprehensive analysis failed:', error);
      throw error;
    }
  }

  /**
   * Create optimized prompt for fast analysis
   */
  createFastAnalysisPrompt(resumeText, targetIndustry, targetRole, industryKeywords = []) {
    return `
Analyze this resume for ATS compatibility. Return only JSON:

RESUME: ${resumeText}
TARGET: ${targetRole} ${targetIndustry}
KEYWORDS: ${industryKeywords.slice(0, 10).join(', ')}

{
  "atsScore": <0-100>,
  "overallGrade": "<A+/A/B+/B/C+/C/D/F>",
  "detailedMetrics": {
    "sectionCompleteness": <0-100>,
    "keywordDensity": <0-100>,
    "formatConsistency": <0-100>
  },
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>", "<weakness3>"],
  "recommendations": ["<rec1>", "<rec2>", "<rec3>"],
  "industryAlignment": <0-100>,
  "contentQuality": <0-100>
}`;
  }

  /**
   * Get fast GPT-4o analysis with reduced tokens
   */
  async getFastGPT4oAnalysis(prompt) {
    try {
      console.log('⚡ Fast GPT-4o analysis...');
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: prompt
        }],
        temperature: 0.1,
        max_tokens: 500, // Reduced tokens for faster response
        timeout: this.config.requestTimeout
      });

      const content = response.choices[0].message.content;
      const jsonContent = this.extractJSONFromResponse(content);
      const analysis = JSON.parse(jsonContent);
      
      console.log('✅ Fast GPT-4o analysis completed');
      return analysis;
      
    } catch (error) {
      console.error('❌ Fast GPT-4o analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get Claude analysis with timeout
   */
  async getClaudeSonnetAnalysisWithTimeout(prompt) {
    return Promise.race([
      this.getClaudeSonnetAnalysis(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Claude analysis timeout')), this.config.requestTimeout)
      )
    ]);
  }

  /**
   * Get GPT-4o analysis with timeout
   */
  async getGPT4oAnalysisWithTimeout(prompt) {
    return Promise.race([
      this.getGPT4oAnalysis(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('GPT-4o analysis timeout')), this.config.requestTimeout)
      )
    ]);
  }

  /**
   * Get cached keywords or fetch and cache
   */
  async getCachedKeywords(industry, role) {
    const cacheKey = `keywords-${industry}-${role}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
        return cached.data;
      }
    }
    
    const keywords = await this.keywordService.getIndustryKeywords(industry, role);
    this.cache.set(cacheKey, {
      data: keywords,
      timestamp: Date.now()
    });
    
    return keywords;
  }

  /**
   * Generate cache key for resume analysis
   */
  generateCacheKey(resumeData, industry, role) {
    const text = resumeData.text || resumeData.rawText || '';
    const hash = crypto.createHash('md5').update(text + industry + role).digest('hex');
    return `analysis-${hash}`;
  }

  /**
   * Cache analysis result
   */
  cacheResult(key, data) {
    // Implement LRU cache eviction
    if (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * Calculate cache hit rate
   */
  calculateCacheHitRate() {
    // This would need to be implemented with proper tracking
    return 0; // Placeholder
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Analysis cache cleared');
  }

  // Include all the original methods from SimpleATSAnalyzer
  createAnalysisPrompt(resumeText, targetIndustry, targetRole, industryKeywords = []) {
    return `
You are an expert ATS (Applicant Tracking System) analyst and resume optimization specialist. Analyze this resume with the precision of a professional recruiter and ATS system.

RESUME TEXT:
${resumeText}

TARGET POSITION: ${targetRole} ${targetIndustry}

INDUSTRY KEYWORDS TO FOCUS ON: ${industryKeywords.slice(0, 20).join(', ')}

ANALYSIS REQUIREMENTS:
Provide a comprehensive ATS compatibility assessment in the following JSON format:

{
  "atsScore": <number between 0-100>,
  "overallGrade": "<A+, A, B+, B, C+, C, D, F>",
  "detailedMetrics": {
    "sectionCompleteness": <number between 0-100>,
    "keywordDensity": <number between 0-100>,
    "formatConsistency": <number between 0-100>,
    "actionVerbs": <number between 0-100>,
    "quantifiedAchievements": <number between 0-100>
  },
  "quickStats": {
    "wordCount": <number>,
    "sectionsFound": <number>,
    "keywordsMatched": <number>,
    "improvementAreas": <number>
  },
  "strengths": ["<detailed_strength1>", "<detailed_strength2>", "<detailed_strength3>", "<detailed_strength4>", "<detailed_strength5>"],
  "weaknesses": ["<detailed_weakness1>", "<detailed_weakness2>", "<detailed_weakness3>", "<detailed_weakness4>", "<detailed_weakness5>"],
  "recommendations": ["<detailed_recommendation1>", "<detailed_recommendation2>", "<detailed_recommendation3>", "<detailed_recommendation4>", "<detailed_recommendation5>"],
  "detailedInsights": {
    "keywordAnalysis": "<detailed analysis of keyword usage and optimization opportunities>",
    "formatAnalysis": "<detailed analysis of resume formatting and structure>",
    "contentAnalysis": "<detailed analysis of content quality and impact>",
    "industryAlignment": "<detailed analysis of industry-specific alignment>",
    "atsCompatibility": "<detailed analysis of ATS system compatibility>"
  },
  "industryAlignment": <number between 0-100>,
  "contentQuality": <number between 0-100>
}

Return only valid JSON. No additional text or explanations outside the JSON structure.
`;
  }

  async getClaudeSonnetAnalysis(prompt) {
    try {
      console.log('🤖 Calling Claude Sonnet 4 API...');
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        temperature: 0.1,
        messages: [{
          role: "user",
          content: prompt
        }]
      });

      const content = response.content[0].text;
      const jsonContent = this.extractJSONFromResponse(content);
      const analysis = JSON.parse(jsonContent);
      
      console.log('✅ Claude Sonnet 4 analysis completed');
      return analysis;
    } catch (error) {
      console.error('❌ Claude Sonnet 4 analysis failed:', error);
      throw error;
    }
  }

  async getGPT4oAnalysis(prompt) {
    try {
      console.log('🤖 Calling GPT-4o API...');
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: prompt
        }],
        temperature: 0.1,
        max_tokens: 1000
      });

      const content = response.choices[0].message.content;
      const jsonContent = this.extractJSONFromResponse(content);
      const analysis = JSON.parse(jsonContent);
      
      console.log('✅ GPT-4o analysis completed');
      return analysis;
    } catch (error) {
      console.error('❌ GPT-4o analysis failed:', error);
      throw error;
    }
  }

  combineAnalysisResults(claudeResult, gpt4oResult, targetIndustry, targetRole) {
    console.log('🔄 Combining analysis results...');
    
    if (claudeResult && gpt4oResult) {
      const combinedScore = Math.round((claudeResult.atsScore + gpt4oResult.atsScore) / 2);
      
      const combined = {
        ...claudeResult,
        atsScore: combinedScore,
        detailedMetrics: {
          sectionCompleteness: Math.round((claudeResult.detailedMetrics?.sectionCompleteness + gpt4oResult.detailedMetrics?.sectionCompleteness) / 2),
          keywordDensity: Math.round((claudeResult.detailedMetrics?.keywordDensity + gpt4oResult.detailedMetrics?.keywordDensity) / 2),
          formatConsistency: Math.round((claudeResult.detailedMetrics?.formatConsistency + gpt4oResult.detailedMetrics?.formatConsistency) / 2),
          actionVerbs: Math.round((claudeResult.detailedMetrics?.actionVerbs + gpt4oResult.detailedMetrics?.actionVerbs) / 2),
          quantifiedAchievements: Math.round((claudeResult.detailedMetrics?.quantifiedAchievements + gpt4oResult.detailedMetrics?.quantifiedAchievements) / 2)
        },
        industryAlignment: Math.round((claudeResult.industryAlignment + gpt4oResult.industryAlignment) / 2),
        contentQuality: Math.round((claudeResult.contentQuality + gpt4oResult.contentQuality) / 2),
        modelsUsed: ['Claude Sonnet 4', 'GPT-4o']
      };
      
      combined.overallGrade = this.calculateGrade(combinedScore);
      return combined;
    }
    
    if (claudeResult) {
      return { ...claudeResult, modelsUsed: ['Claude Sonnet 4'] };
    }
    
    if (gpt4oResult) {
      return { ...gpt4oResult, modelsUsed: ['GPT-4o'] };
    }
    
    return this.getFallbackAnalysis(targetIndustry, targetRole);
  }

  calculateGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  extractJSONFromResponse(content) {
    let jsonContent = content.trim();
    
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return jsonContent.trim();
  }

  getFallbackAnalysis(targetIndustry, targetRole) {
    console.log('🔄 Using fallback analysis');
    return {
      atsScore: 50,
      overallGrade: 'C',
      detailedMetrics: {
        sectionCompleteness: 50,
        keywordDensity: 50,
        formatConsistency: 50,
        actionVerbs: 50,
        quantifiedAchievements: 50
      },
      quickStats: {
        wordCount: 0,
        sectionsFound: 0,
        keywordsMatched: 0,
        improvementAreas: 0
      },
      strengths: ['Resume submitted successfully'],
      weaknesses: ['AI analysis unavailable'],
      recommendations: ['Please try again'],
      industryAlignment: 50,
      contentQuality: 50,
      modelsUsed: ['Default Fallback']
    };
  }
}

module.exports = OptimizedATSAnalyzer;