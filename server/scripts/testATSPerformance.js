#!/usr/bin/env node

/**
 * ATS Analyzer Performance Test Script
 * 
 * This script tests the performance of the ATS analyzer to identify bottlenecks
 * that cause analysis to take more than a minute.
 */

const fs = require('fs');
const path = require('path');
const SimpleATSAnalyzer = require('../utils/simpleATSAnalyzer');
const EnhancedResumeParser = require('../utils/enhancedResumeParser');
const DynamicKeywordService = require('../utils/dynamicKeywordService');
const IndustryBenchmarks = require('../utils/industryBenchmarks');

class ATSPerformanceTester {
  constructor() {
    this.analyzer = new SimpleATSAnalyzer();
    this.parser = new EnhancedResumeParser();
    this.keywordService = new DynamicKeywordService();
    this.benchmarks = new IndustryBenchmarks();
    
    this.results = {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      averageTime: 0,
      bottlenecks: [],
      recommendations: []
    };
  }

  /**
   * Run comprehensive performance tests
   */
  async runPerformanceTests() {
    console.log('🚀 Starting ATS Analyzer Performance Tests...\n');
    
    try {
      // Test 1: Resume Parsing Performance
      await this.testResumeParsingPerformance();
      
      // Test 2: AI Model Performance
      await this.testAIModelPerformance();
      
      // Test 3: Keyword Service Performance
      await this.testKeywordServicePerformance();
      
      // Test 4: Industry Benchmarks Performance
      await this.testIndustryBenchmarksPerformance();
      
      // Test 5: End-to-End Analysis Performance
      await this.testEndToEndPerformance();
      
      // Generate performance report
      this.generatePerformanceReport();
      
    } catch (error) {
      console.error('❌ Performance testing failed:', error);
    }
  }

  /**
   * Test resume parsing performance with different file types
   */
  async testResumeParsingPerformance() {
    console.log('📄 Testing Resume Parsing Performance...');
    
    const testFiles = [
      { name: 'sample-resume.pdf', type: 'application/pdf' },
      { name: 'sample-resume.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'sample-resume.txt', type: 'text/plain' }
    ];

    for (const testFile of testFiles) {
      const filePath = path.join(__dirname, '../temp', testFile.name);
      
      if (fs.existsSync(filePath)) {
        console.log(`\n🔍 Testing ${testFile.name}...`);
        
        const startTime = Date.now();
        
        try {
          const result = await this.parser.parseResume(filePath, testFile.type);
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          console.log(`✅ Parsing completed in ${duration}ms`);
          console.log(`📊 Text length: ${result.text?.length || 0} characters`);
          console.log(`🎯 Parsing method: ${result.parsingMethod || 'unknown'}`);
          console.log(`📈 Quality score: ${result.quality || 'N/A'}/100`);
          console.log(`🔍 Confidence: ${result.confidence || 'N/A'}/100`);
          
          // Check for performance issues
          if (duration > 10000) { // 10 seconds
            this.results.bottlenecks.push({
              component: 'Resume Parsing',
              file: testFile.name,
              duration: duration,
              issue: 'Parsing took longer than 10 seconds',
              severity: 'high'
            });
          }
          
          this.results.successfulTests++;
          
        } catch (error) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          console.log(`❌ Parsing failed after ${duration}ms: ${error.message}`);
          this.results.failedTests++;
        }
        
        this.results.totalTests++;
      } else {
        console.log(`⚠️ Test file not found: ${filePath}`);
      }
    }
  }

  /**
   * Test AI model performance individually
   */
  async testAIModelPerformance() {
    console.log('\n🤖 Testing AI Model Performance...');
    
    const sampleResumeText = `
    John Doe
    Software Engineer
    john.doe@email.com
    (555) 123-4567
    
    EXPERIENCE
    Senior Software Engineer at Tech Corp (2020-2024)
    - Led development of microservices architecture
    - Improved system performance by 40%
    - Managed team of 5 developers
    
    Software Engineer at Startup Inc (2018-2020)
    - Developed REST APIs using Node.js
    - Implemented CI/CD pipelines
    - Reduced deployment time by 60%
    
    EDUCATION
    Bachelor of Science in Computer Science
    University of Technology (2014-2018)
    
    SKILLS
    JavaScript, Python, Node.js, React, AWS, Docker, Kubernetes
    `;

    const industryKeywords = ['javascript', 'python', 'node.js', 'react', 'aws', 'docker'];
    const analysisPrompt = this.analyzer.createAnalysisPrompt(sampleResumeText, 'technology', 'Senior', industryKeywords);

    // Test Claude Sonnet 4 performance
    console.log('\n🔍 Testing Claude Sonnet 4...');
    const claudeStartTime = Date.now();
    
    try {
      const claudeResult = await this.analyzer.getClaudeSonnetAnalysis(analysisPrompt);
      const claudeEndTime = Date.now();
      const claudeDuration = claudeEndTime - claudeStartTime;
      
      console.log(`✅ Claude Sonnet 4 completed in ${claudeDuration}ms`);
      console.log(`📊 ATS Score: ${claudeResult.atsScore}`);
      console.log(`📈 Grade: ${claudeResult.overallGrade}`);
      
      if (claudeDuration > 30000) { // 30 seconds
        this.results.bottlenecks.push({
          component: 'Claude Sonnet 4',
          duration: claudeDuration,
          issue: 'Claude analysis took longer than 30 seconds',
          severity: 'high'
        });
      }
      
      this.results.successfulTests++;
      
    } catch (error) {
      const claudeEndTime = Date.now();
      const claudeDuration = claudeEndTime - claudeStartTime;
      
      console.log(`❌ Claude Sonnet 4 failed after ${claudeDuration}ms: ${error.message}`);
      this.results.failedTests++;
    }

    // Test GPT-4o performance
    console.log('\n🔍 Testing GPT-4o...');
    const gptStartTime = Date.now();
    
    try {
      const gptResult = await this.analyzer.getGPT4oAnalysis(analysisPrompt);
      const gptEndTime = Date.now();
      const gptDuration = gptEndTime - gptStartTime;
      
      console.log(`✅ GPT-4o completed in ${gptDuration}ms`);
      console.log(`📊 ATS Score: ${gptResult.atsScore}`);
      console.log(`📈 Grade: ${gptResult.overallGrade}`);
      
      if (gptDuration > 30000) { // 30 seconds
        this.results.bottlenecks.push({
          component: 'GPT-4o',
          duration: gptDuration,
          issue: 'GPT-4o analysis took longer than 30 seconds',
          severity: 'high'
        });
      }
      
      this.results.successfulTests++;
      
    } catch (error) {
      const gptEndTime = Date.now();
      const gptDuration = gptEndTime - gptStartTime;
      
      console.log(`❌ GPT-4o failed after ${gptDuration}ms: ${error.message}`);
      this.results.failedTests++;
    }

    this.results.totalTests += 2;
  }

  /**
   * Test keyword service performance
   */
  async testKeywordServicePerformance() {
    console.log('\n🔑 Testing Keyword Service Performance...');
    
    const testCases = [
      { industry: 'technology', role: 'Senior' },
      { industry: 'healthcare', role: 'Manager' },
      { industry: 'finance', role: 'Analyst' }
    ];

    for (const testCase of testCases) {
      console.log(`\n🔍 Testing ${testCase.industry} ${testCase.role}...`);
      
      const startTime = Date.now();
      
      try {
        const keywords = await this.keywordService.getIndustryKeywords(testCase.industry, testCase.role);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Keywords retrieved in ${duration}ms`);
        console.log(`📊 Keywords count: ${keywords.length}`);
        
        if (duration > 5000) { // 5 seconds
          this.results.bottlenecks.push({
            component: 'Keyword Service',
            industry: testCase.industry,
            role: testCase.role,
            duration: duration,
            issue: 'Keyword retrieval took longer than 5 seconds',
            severity: 'medium'
          });
        }
        
        this.results.successfulTests++;
        
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`❌ Keyword service failed after ${duration}ms: ${error.message}`);
        this.results.failedTests++;
      }
      
      this.results.totalTests++;
    }
  }

  /**
   * Test industry benchmarks performance
   */
  async testIndustryBenchmarksPerformance() {
    console.log('\n📊 Testing Industry Benchmarks Performance...');
    
    const mockAnalysis = {
      atsScore: 85,
      overallGrade: 'B+',
      detailedMetrics: {
        sectionCompleteness: 90,
        keywordDensity: 80,
        formatConsistency: 85,
        actionVerbs: 75,
        quantifiedAchievements: 70
      }
    };

    const testCases = [
      { industry: 'technology', role: 'Senior' },
      { industry: 'healthcare', role: 'Manager' },
      { industry: 'finance', role: 'Analyst' }
    ];

    for (const testCase of testCases) {
      console.log(`\n🔍 Testing benchmarks for ${testCase.industry} ${testCase.role}...`);
      
      const startTime = Date.now();
      
      try {
        const benchmarkData = this.benchmarks.compareWithBenchmark(mockAnalysis, testCase.industry, testCase.role);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Benchmarks calculated in ${duration}ms`);
        console.log(`📊 Industry average: ${benchmarkData.comparison?.industryAverage || 'N/A'}`);
        console.log(`📈 Percentile: ${benchmarkData.comparison?.percentile || 'N/A'}`);
        
        if (duration > 2000) { // 2 seconds
          this.results.bottlenecks.push({
            component: 'Industry Benchmarks',
            industry: testCase.industry,
            role: testCase.role,
            duration: duration,
            issue: 'Benchmark calculation took longer than 2 seconds',
            severity: 'low'
          });
        }
        
        this.results.successfulTests++;
        
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`❌ Benchmarks failed after ${duration}ms: ${error.message}`);
        this.results.failedTests++;
      }
      
      this.results.totalTests++;
    }
  }

  /**
   * Test end-to-end analysis performance
   */
  async testEndToEndPerformance() {
    console.log('\n🔄 Testing End-to-End Analysis Performance...');
    
    const sampleResumeData = {
      text: `
      John Doe
      Senior Software Engineer
      john.doe@email.com
      (555) 123-4567
      
      EXPERIENCE
      Senior Software Engineer at Tech Corp (2020-2024)
      - Led development of microservices architecture serving 1M+ users
      - Improved system performance by 40% through optimization
      - Managed team of 5 developers and delivered 15+ projects
      - Implemented CI/CD pipelines reducing deployment time by 60%
      
      Software Engineer at Startup Inc (2018-2020)
      - Developed REST APIs using Node.js and Express
      - Built responsive web applications with React
      - Integrated third-party services and payment systems
      - Collaborated with cross-functional teams of 8+ members
      
      EDUCATION
      Bachelor of Science in Computer Science
      University of Technology (2014-2018)
      GPA: 3.8/4.0
      
      SKILLS
      Programming: JavaScript, Python, Java, TypeScript
      Frameworks: React, Node.js, Express, Django
      Cloud: AWS, Docker, Kubernetes, Terraform
      Databases: PostgreSQL, MongoDB, Redis
      Tools: Git, Jenkins, Jira, Confluence
      `,
      fileName: 'test-resume.txt',
      fileSize: 1500,
      parsedAt: new Date().toISOString()
    };

    console.log('\n🔍 Running complete ATS analysis...');
    const startTime = Date.now();
    
    try {
      const analysis = await this.analyzer.analyzeResume(sampleResumeData, 'technology', 'Senior');
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Complete analysis finished in ${duration}ms`);
      console.log(`📊 Final ATS Score: ${analysis.atsScore}`);
      console.log(`📈 Overall Grade: ${analysis.overallGrade}`);
      console.log(`🤖 Models used: ${analysis.modelsUsed?.join(', ') || 'Unknown'}`);
      console.log(`💪 Strengths: ${analysis.strengths?.length || 0}`);
      console.log(`⚠️ Weaknesses: ${analysis.weaknesses?.length || 0}`);
      console.log(`💡 Recommendations: ${analysis.recommendations?.length || 0}`);
      
      // Check for performance issues
      if (duration > 60000) { // 1 minute
        this.results.bottlenecks.push({
          component: 'End-to-End Analysis',
          duration: duration,
          issue: 'Complete analysis took longer than 1 minute',
          severity: 'critical'
        });
      } else if (duration > 30000) { // 30 seconds
        this.results.bottlenecks.push({
          component: 'End-to-End Analysis',
          duration: duration,
          issue: 'Complete analysis took longer than 30 seconds',
          severity: 'high'
        });
      }
      
      this.results.averageTime = duration;
      this.results.successfulTests++;
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`❌ End-to-end analysis failed after ${duration}ms: ${error.message}`);
      this.results.failedTests++;
    }
    
    this.results.totalTests++;
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 ATS ANALYZER PERFORMANCE REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Test Summary:`);
    console.log(`   Total Tests: ${this.results.totalTests}`);
    console.log(`   Successful: ${this.results.successfulTests}`);
    console.log(`   Failed: ${this.results.failedTests}`);
    console.log(`   Success Rate: ${((this.results.successfulTests / this.results.totalTests) * 100).toFixed(1)}%`);
    console.log(`   Average Analysis Time: ${this.results.averageTime}ms`);
    
    if (this.results.bottlenecks.length > 0) {
      console.log(`\n⚠️ Performance Bottlenecks Found:`);
      this.results.bottlenecks.forEach((bottleneck, index) => {
        console.log(`   ${index + 1}. ${bottleneck.component}`);
        console.log(`      Duration: ${bottleneck.duration}ms`);
        console.log(`      Issue: ${bottleneck.issue}`);
        console.log(`      Severity: ${bottleneck.severity.toUpperCase()}`);
        if (bottleneck.file) console.log(`      File: ${bottleneck.file}`);
        if (bottleneck.industry) console.log(`      Industry: ${bottleneck.industry}`);
        if (bottleneck.role) console.log(`      Role: ${bottleneck.role}`);
        console.log('');
      });
    } else {
      console.log(`\n✅ No significant performance bottlenecks found!`);
    }
    
    // Generate recommendations
    this.generateRecommendations();
    
    console.log('\n💡 Performance Recommendations:');
    this.results.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    
    console.log('\n' + '='.repeat(80));
  }

  /**
   * Generate performance optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check for AI model bottlenecks
    const aiBottlenecks = this.results.bottlenecks.filter(b => 
      b.component.includes('Claude') || b.component.includes('GPT')
    );
    
    if (aiBottlenecks.length > 0) {
      recommendations.push('Consider implementing AI model response caching to reduce repeated API calls');
      recommendations.push('Optimize AI prompts to be more concise while maintaining quality');
      recommendations.push('Implement timeout handling for AI model requests');
      recommendations.push('Consider using faster AI models for initial analysis');
    }
    
    // Check for parsing bottlenecks
    const parsingBottlenecks = this.results.bottlenecks.filter(b => 
      b.component.includes('Parsing')
    );
    
    if (parsingBottlenecks.length > 0) {
      recommendations.push('Implement file parsing result caching');
      recommendations.push('Optimize PDF parsing by using the most efficient method first');
      recommendations.push('Add file size limits and early validation');
      recommendations.push('Consider parallel parsing for multiple file types');
    }
    
    // Check for keyword service bottlenecks
    const keywordBottlenecks = this.results.bottlenecks.filter(b => 
      b.component.includes('Keyword')
    );
    
    if (keywordBottlenecks.length > 0) {
      recommendations.push('Cache keyword results by industry/role combination');
      recommendations.push('Pre-load common keyword sets');
      recommendations.push('Implement keyword service response optimization');
    }
    
    // General recommendations
    if (this.results.averageTime > 60000) {
      recommendations.push('Implement parallel processing for independent operations');
      recommendations.push('Add progress tracking and early termination for long operations');
      recommendations.push('Consider breaking analysis into smaller, cached chunks');
    }
    
    recommendations.push('Implement request queuing to handle concurrent analysis requests');
    recommendations.push('Add performance monitoring and alerting for analysis times');
    recommendations.push('Consider implementing analysis result caching for identical resumes');
    
    this.results.recommendations = recommendations;
  }
}

// Run the performance tests
async function main() {
  const tester = new ATSPerformanceTester();
  await tester.runPerformanceTests();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ATSPerformanceTester;