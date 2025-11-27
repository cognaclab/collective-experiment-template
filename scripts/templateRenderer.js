/**
 * Template Renderer - Generate consent forms and questionnaires from templates
 *
 * This utility renders EJS templates with experiment configuration data to create
 * customized consent forms, questionnaires, and debrief pages.
 */

const fs = require('fs').promises;
const path = require('path');
const ejs = require('ejs');

class TemplateRenderer {
  constructor(config, experimentPath) {
    this.config = config;
    this.experimentPath = experimentPath;
    this.templatesDir = path.join(__dirname, '..', 'config', 'templates');
  }

  /**
   * Render all templates for the experiment
   */
  async renderAll() {
    const results = {};

    try {
      // Render consent form
      if (this.config.consent && this.config.consent.enabled) {
        results.consent = await this.renderConsentForm();
      }

      // Render questionnaire
      if (this.config.questionnaire && this.config.questionnaire.enabled) {
        results.questionnaire = await this.renderQuestionnaire();
      }

      // Render debrief
      if (this.config.debrief && this.config.debrief.enabled) {
        results.debrief = await this.renderDebrief();
      }

      return results;
    } catch (error) {
      console.error('Error rendering templates:', error);
      throw error;
    }
  }

  /**
   * Calculate compensation details from payment config
   * @returns {Object} - Calculated compensation info
   */
  calculateCompensation() {
    const payment = this.config.payment || {};
    const currency = payment.currency || 'GBP';
    const currencySymbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;

    const flatFee = payment.flat_fee || 0;
    const completionFee = payment.completion_fee || 0;
    const minimumPayment = flatFee + completionFee;

    // Build breakdown components
    const breakdownParts = [];
    if (flatFee > 0) {
      breakdownParts.push(`${currencySymbol}${flatFee.toFixed(2)} base fee`);
    }
    if (completionFee > 0) {
      breakdownParts.push(`${currencySymbol}${completionFee.toFixed(2)} completion bonus`);
    }
    if (payment.points_to_currency && payment.points_to_currency > 0) {
      breakdownParts.push('performance bonus based on your decisions');
    }

    return {
      minimumPayment: minimumPayment,
      minimumFormatted: `${currencySymbol}${minimumPayment.toFixed(2)}`,
      currency: currency,
      currencySymbol: currencySymbol,
      breakdown: breakdownParts.join(' + '),
      hasPerformanceBonus: payment.points_to_currency && payment.points_to_currency > 0
    };
  }

  /**
   * Render consent form
   */
  async renderConsentForm() {
    const templatePath = path.join(this.templatesDir, 'consent', 'consent-form.ejs');
    const outputPath = path.join(this.experimentPath, 'pages', 'consent.html');

    const templateData = {
      study: this.config.study || {},
      consent: this.config.consent || {},
      experiment: this.config.experiment || {},
      payment: this.config.payment || {},
      compensation: this.calculateCompensation()
    };

    const html = await this.renderTemplate(templatePath, templateData);
    await fs.writeFile(outputPath, html, 'utf8');

    console.log(`✓ Generated consent form: ${outputPath}`);
    return outputPath;
  }

  /**
   * Render questionnaire
   */
  async renderQuestionnaire() {
    // Check if custom questionnaire.html already exists (skip generation)
    const customTemplatePath = path.join(this.experimentPath, 'pages', 'questionnaire.html');
    const customTemplateExists = await this.fileExists(customTemplatePath);

    if (customTemplateExists) {
      console.log(`✓ Using custom questionnaire: ${customTemplatePath}`);
      return customTemplatePath;
    }

    // Use styled questionnaire template
    const templatePath = path.join(this.templatesDir, 'questionnaire', 'questionnaire-form.ejs');
    const templateExists = await this.fileExists(templatePath);

    if (!templateExists) {
      console.log('⚠ No questionnaire template found, skipping');
      return null;
    }

    // Ensure output directory exists
    const outputDir = path.join(this.experimentPath, 'pages');
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
      // Directory may already exist
    }

    const outputPath = path.join(outputDir, 'questionnaire.html');

    const templateData = {
      study: this.config.study || {},
      questionnaire: this.config.questionnaire || {},
      experiment: this.config.experiment || {},
      payment: this.config.payment || {},
      compensation: this.calculateCompensation(),
      conditions: this.config.conditions || {}
    };

    const html = await this.renderTemplate(templatePath, templateData);
    await fs.writeFile(outputPath, html, 'utf8');

    console.log(`✓ Generated questionnaire: ${outputPath}`);
    return outputPath;
  }

  /**
   * Render debrief page
   */
  async renderDebrief() {
    const templatePath = path.join(this.templatesDir, 'debrief', 'debrief.ejs');
    const templateExists = await this.fileExists(templatePath);

    if (!templateExists) {
      console.log('⚠ No debrief template found, skipping');
      return null;
    }

    const outputPath = path.join(this.experimentPath, 'pages', 'debrief.html');

    const templateData = {
      study: this.config.study || {},
      debrief: this.config.debrief || {},
      experiment: this.config.experiment || {}
    };

    const html = await this.renderTemplate(templatePath, templateData);
    await fs.writeFile(outputPath, html, 'utf8');

    console.log(`✓ Generated debrief page: ${outputPath}`);
    return outputPath;
  }

  /**
   * Render an EJS template
   * @param {string} templatePath - Path to template file
   * @param {Object} data - Data to pass to template
   * @returns {Promise<string>} - Rendered HTML
   */
  async renderTemplate(templatePath, data) {
    try {
      const template = await fs.readFile(templatePath, 'utf8');
      const html = ejs.render(template, data, {
        filename: templatePath // For includes to work
      });
      return html;
    } catch (error) {
      console.error(`Error rendering template ${templatePath}:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Merge config with defaults
   * @param {Object} config - User config
   * @param {Object} defaults - Default config
   * @returns {Object} - Merged config
   */
  mergeWithDefaults(config, defaults) {
    return {
      ...defaults,
      ...config,
      study: {
        ...defaults.study,
        ...config.study
      },
      consent: {
        ...defaults.consent,
        ...config.consent
      },
      questionnaire: {
        ...defaults.questionnaire,
        ...config.questionnaire
      }
    };
  }
}

/**
 * Load default configuration
 * @returns {Promise<Object>} - Default config object
 */
async function loadDefaults() {
  const defaultsPath = path.join(__dirname, '..', 'config', 'consent-questionnaire-schema.yaml');

  try {
    const yaml = require('js-yaml');
    const content = await fs.readFile(defaultsPath, 'utf8');
    return yaml.load(content);
  } catch (error) {
    console.warn('Could not load defaults, using minimal config');
    return {};
  }
}

module.exports = {
  TemplateRenderer,
  loadDefaults
};
