/**
 * Rubric Loader for Clinician Coaching
 * 
 * Loads and parses coaching rubrics from content_coaching/rubrics.
 * 
 * IMPORTANT: This module is for CLINICIAN coaching only.
 * It must NEVER import from:
 *   - Patient prompts (server/prompt.js, server/prompts/patient/*)
 *   - Patient content (/content/*)
 *   - Patient RAG system (server/rag.js)
 */

const fs = require('fs');
const path = require('path');

// Path to rubrics directory (relative to project root)
const RUBRICS_DIR = path.join(__dirname, '../../content_coaching/rubrics');
const CHECKLISTS_DIR = path.join(__dirname, '../../content_coaching/checklists');

/**
 * Parse rubric metadata from markdown content
 * Extracts title, version, and description from file header
 * 
 * @param {string} content - Raw markdown content
 * @param {string} filename - Original filename
 * @returns {Object} - { title, version, lastUpdated, appliesTo }
 */
function parseRubricMetadata(content, filename) {
  const metadata = {
    title: filename.replace(/\.md$/, '').replace(/_/g, ' '),
    version: null,
    lastUpdated: null,
    appliesTo: null
  };

  // Extract title from first H1
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Extract version from **Version:** line
  const versionMatch = content.match(/\*\*Version:\*\*\s*(.+)$/m);
  if (versionMatch) {
    metadata.version = versionMatch[1].trim();
  }

  // Extract last updated from **Last Updated:** line
  const dateMatch = content.match(/\*\*Last Updated:\*\*\s*(.+)$/m);
  if (dateMatch) {
    metadata.lastUpdated = dateMatch[1].trim();
  }

  // Extract applies to from **Applies To:** line
  const appliesToMatch = content.match(/\*\*Applies To:\*\*\s*(.+)$/m);
  if (appliesToMatch) {
    metadata.appliesTo = appliesToMatch[1].trim();
  }

  return metadata;
}

/**
 * List all available rubrics
 * 
 * @returns {Promise<Array>} - Array of { id, title, version, lastUpdated, appliesTo }
 */
async function listRubrics() {
  try {
    // Check if directory exists
    if (!fs.existsSync(RUBRICS_DIR)) {
      console.warn('⚠️ Rubrics directory not found:', RUBRICS_DIR);
      return [];
    }

    const files = fs.readdirSync(RUBRICS_DIR);
    const rubrics = [];

    for (const file of files) {
      // Only process markdown files
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(RUBRICS_DIR, file);
      const stat = fs.statSync(filePath);
      
      // Skip directories
      if (stat.isDirectory()) continue;

      // Read and parse file
      const content = fs.readFileSync(filePath, 'utf-8');
      const metadata = parseRubricMetadata(content, file);

      rubrics.push({
        id: file.replace(/\.md$/, ''),
        filename: file,
        ...metadata,
        fileSize: stat.size,
        fileModified: stat.mtime.toISOString()
      });
    }

    // Sort by title
    rubrics.sort((a, b) => a.title.localeCompare(b.title));

    return rubrics;
  } catch (error) {
    console.error('❌ Error listing rubrics:', error);
    throw error;
  }
}

/**
 * Load a specific rubric by ID
 * 
 * @param {string} rubricId - Rubric ID (filename without .md extension)
 * @returns {Promise<Object>} - { id, metadata, content, sections }
 */
async function loadRubric(rubricId) {
  try {
    // Sanitize rubricId to prevent path traversal
    const sanitizedId = rubricId.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(RUBRICS_DIR, `${sanitizedId}.md`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const metadata = parseRubricMetadata(content, `${sanitizedId}.md`);

    // Parse sections (H2 headers)
    const sections = [];
    const sectionRegex = /^##\s+(.+)$/gm;
    let match;
    let lastIndex = 0;
    let lastTitle = null;

    while ((match = sectionRegex.exec(content)) !== null) {
      if (lastTitle !== null) {
        sections.push({
          title: lastTitle,
          content: content.substring(lastIndex, match.index).trim()
        });
      }
      lastTitle = match[1].trim();
      lastIndex = match.index + match[0].length;
    }

    // Add the last section
    if (lastTitle !== null) {
      sections.push({
        title: lastTitle,
        content: content.substring(lastIndex).trim()
      });
    }

    return {
      id: sanitizedId,
      metadata,
      content,
      sections,
      sectionCount: sections.length
    };
  } catch (error) {
    console.error(`❌ Error loading rubric ${rubricId}:`, error);
    throw error;
  }
}

/**
 * List all available checklists
 * 
 * @returns {Promise<Array>} - Array of { id, title, filename }
 */
async function listChecklists() {
  try {
    if (!fs.existsSync(CHECKLISTS_DIR)) {
      console.warn('⚠️ Checklists directory not found:', CHECKLISTS_DIR);
      return [];
    }

    const files = fs.readdirSync(CHECKLISTS_DIR);
    const checklists = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(CHECKLISTS_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const titleMatch = content.match(/^#\s+(.+)$/m);

      checklists.push({
        id: file.replace(/\.md$/, ''),
        filename: file,
        title: titleMatch ? titleMatch[1].trim() : file.replace(/\.md$/, '').replace(/_/g, ' ')
      });
    }

    return checklists;
  } catch (error) {
    console.error('❌ Error listing checklists:', error);
    throw error;
  }
}

/**
 * Load a specific checklist by ID
 * 
 * @param {string} checklistId - Checklist ID (filename without .md extension)
 * @returns {Promise<Object|null>} - { id, title, content } or null if not found
 */
async function loadChecklist(checklistId) {
  try {
    const sanitizedId = checklistId.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(CHECKLISTS_DIR, `${sanitizedId}.md`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const titleMatch = content.match(/^#\s+(.+)$/m);

    return {
      id: sanitizedId,
      title: titleMatch ? titleMatch[1].trim() : sanitizedId.replace(/_/g, ' '),
      content
    };
  } catch (error) {
    console.error(`❌ Error loading checklist ${checklistId}:`, error);
    throw error;
  }
}

/**
 * Check if the coaching content directories exist
 * 
 * @returns {Object} - { rubricsDir: boolean, checklistsDir: boolean }
 */
function checkDirectories() {
  return {
    rubricsDir: fs.existsSync(RUBRICS_DIR),
    checklistsDir: fs.existsSync(CHECKLISTS_DIR),
    rubricsDirPath: RUBRICS_DIR,
    checklistsDirPath: CHECKLISTS_DIR
  };
}

module.exports = {
  listRubrics,
  loadRubric,
  listChecklists,
  loadChecklist,
  checkDirectories,
  parseRubricMetadata
};
