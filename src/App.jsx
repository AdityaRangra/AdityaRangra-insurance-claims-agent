import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

const InsuranceClaimsAgent = () => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [file, setFile] = useState(null);

  const extractFields = (text) => {
    const fields = {};
    const policyMatch = text.match(/POLICY\s*NUMBER[:\s]*([A-Z0-9-]+)/i);
    fields.policyNumber = policyMatch ? policyMatch[1].trim() : null;
    const nameMatch = text.match(/NAME\s+OF\s+INSURED[:\s]*\(First,\s*Middle,\s*Last\)[:\s]*([^\n]+)/i);
    fields.policyholderName = nameMatch ? nameMatch[1].trim() : null;
    const dateMatch = text.match(/DATE\s+OF\s+LOSS[:\s]*(?:AND\s+TIME[:\s]*)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    fields.incidentDate = dateMatch ? dateMatch[1].trim() : null;
    const timeMatch = text.match(/(?:DATE\s+OF\s+LOSS.*?)(\d{1,2}:\d{2})\s*(AM|PM)/i);
    fields.incidentTime = timeMatch ? `${timeMatch[1]} ${timeMatch[2]}` : null;
    const locationMatch = text.match(/LOCATION\s+OF\s+LOSS[:\s]*STREET[:\s]*([^\n]+)/i);
    fields.location = locationMatch ? locationMatch[1].trim() : null;
    const descMatch = text.match(/DESCRIPTION\s+OF\s+ACCIDENT[:\s]*([^\n]+(?:\n(?![\w\s]*:)[^\n]+)*)/i);
    fields.description = descMatch ? descMatch[1].trim().replace(/\s+/g, ' ') : null;
    const driverMatch = text.match(/DRIVER'S\s+NAME\s+AND\s+ADDRESS[:\s]*([^\n]+)/i);
    fields.claimant = driverMatch ? driverMatch[1].trim() : null;
    const phoneMatch = text.match(/PRIMARY\s+PHONE\s*#[:\s]*(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i);
    fields.contactPhone = phoneMatch ? phoneMatch[1].trim() : null;
    const emailMatch = text.match(/PRIMARY\s+E-MAIL\s+ADDRESS[:\s]*([^\n\s]+@[^\n\s]+)/i);
    fields.contactEmail = emailMatch ? emailMatch[1].trim() : null;
    const vinMatch = text.match(/V\.I\.N\.[:\s]*([A-Z0-9]{17})/i);
    fields.assetId = vinMatch ? vinMatch[1].trim() : null;
    const makeMatch = text.match(/MAKE[:\s]*([^\n]+?)(?:\s+MODEL|$)/i);
    const modelMatch = text.match(/MODEL[:\s]*([^\n]+?)(?:\s+YEAR|$)/i);
    const yearMatch = text.match(/YEAR[:\s]*(\d{4})/i);
    if (makeMatch && modelMatch && yearMatch) {
      fields.assetType = `${yearMatch[1]} ${makeMatch[1].trim()} ${modelMatch[1].trim()}`;
    } else {
      fields.assetType = 'Vehicle';
    }
    const estimateMatch = text.match(/ESTIMATE\s+AMOUNT[:\s]*\$?\s*([\d,]+\.?\d*)/i);
    fields.estimatedDamage = estimateMatch ? parseFloat(estimateMatch[1].replace(/,/g, '')) : null;
    if (text.match(/injur(?:y|ed|ies)/i)) {
      fields.claimType = 'injury';
    } else if (text.match(/collision|accident/i)) {
      fields.claimType = 'collision';
    } else if (text.match(/theft|stolen/i)) {
      fields.claimType = 'theft';
    } else {
      fields.claimType = 'property';
    }
    return fields;
  };

  const validateFields = (fields) => {
    const mandatoryFields = [
      { key: 'policyNumber', label: 'Policy Number' },
      { key: 'policyholderName', label: 'Policyholder Name' },
      { key: 'incidentDate', label: 'Incident Date' },
      { key: 'location', label: 'Location' },
      { key: 'description', label: 'Description' },
      { key: 'claimant', label: 'Claimant' },
      { key: 'assetType', label: 'Asset Type' },
      { key: 'assetId', label: 'Asset ID' },
      { key: 'estimatedDamage', label: 'Estimated Damage' },
      { key: 'claimType', label: 'Claim Type' }
    ];
    const missing = [];
    mandatoryFields.forEach(field => {
      if (!fields[field.key] || fields[field.key] === '') {
        missing.push(field.label);
      }
    });
    return missing;
  };

  const routeClaim = (fields, missingFields, text) => {
    let route = '';
    let reasoning = [];
    if (missingFields.length > 0) {
      route = 'Manual Review';
      reasoning.push(`Missing mandatory fields: ${missingFields.join(', ')}`);
      return { route, reasoning: reasoning.join(' | ') };
    }
    const fraudKeywords = ['fraud', 'inconsistent', 'staged', 'suspicious', 'fabricated'];
    const hasFraudIndicators = fraudKeywords.some(keyword => text.toLowerCase().includes(keyword));
    if (hasFraudIndicators) {
      route = 'Investigation';
      reasoning.push('Fraud indicators detected in description');
      return { route, reasoning: reasoning.join(' | ') };
    }
    if (fields.claimType === 'injury') {
      route = 'Specialist Queue';
      reasoning.push('Injury claim requires specialist review');
      return { route, reasoning: reasoning.join(' | ') };
    }
    if (fields.estimatedDamage !== null) {
      if (fields.estimatedDamage < 25000) {
        route = 'Fast-track';
        reasoning.push(`Low damage estimate ($${fields.estimatedDamage.toLocaleString()}) qualifies for fast-track processing`);
      } else {
        route = 'Standard Processing';
        reasoning.push(`Damage estimate ($${fields.estimatedDamage.toLocaleString()}) exceeds fast-track threshold`);
      }
    } else {
      route = 'Manual Review';
      reasoning.push('Unable to determine damage estimate');
    }
    return { route, reasoning: reasoning.join(' | ') };
  };

  const processDocument = async (fileContent) => {
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const extractedFields = extractFields(fileContent);
    const missingFields = validateFields(extractedFields);
    const { route, reasoning } = routeClaim(extractedFields, missingFields, fileContent);
    const output = { extractedFields, missingFields, recommendedRoute: route, reasoning };
    setResult(output);
    setProcessing(false);
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    const reader = new FileReader();
    reader.onload = (event) => { processDocument(event.target.result); };
    reader.readAsText(uploadedFile);
  };

  const getRouteIcon = (route) => {
    switch(route) {
      case 'Fast-track': return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'Manual Review': return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      case 'Investigation': return <AlertTriangle className="w-6 h-6 text-red-500" />;
      case 'Specialist Queue': return <Clock className="w-6 h-6 text-blue-500" />;
      default: return <FileText className="w-6 h-6 text-gray-500" />;
    }
  };

  const getRouteColor = (route) => {
    switch(route) {
      case 'Fast-track': return 'bg-green-50 border-green-200';
      case 'Manual Review': return 'bg-yellow-50 border-yellow-200';
      case 'Investigation': return 'bg-red-50 border-red-200';
      case 'Specialist Queue': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const loadSampleFNOL = () => {
    const sampleText = `AUTOMOBILE LOSS NOTICE
POLICY NUMBER: AUTO-2024-12345
NAME OF INSURED: John Michael Smith
INSURED'S MAILING ADDRESS: 123 Main Street, Springfield, IL 62701
DATE OF BIRTH: 05/15/1980
PRIMARY PHONE #: (555) 123-4567
PRIMARY E-MAIL ADDRESS: john.smith@email.com

DATE OF LOSS AND TIME: 12/01/2024 2:30 PM

LOCATION OF LOSS
STREET: Highway 55 and Oak Street Intersection
CITY, STATE, ZIP: Springfield, IL 62702

DESCRIPTION OF ACCIDENT:
Vehicle was proceeding through green light when another vehicle ran red light and struck driver side. Impact caused significant damage to door and front quarter panel. Airbags deployed. No injuries reported at scene.

DRIVER'S NAME AND ADDRESS: John Michael Smith
DRIVER'S LICENSE NUMBER: S123456789
STATE: IL

INSURED VEHICLE
VEH #: 1
YEAR: 2022
MAKE: Toyota
MODEL: Camry
TYPE: Sedan
V.I.N.: 1HGBH41JXMN109186
PLATE NUMBER: ABC 1234
STATE: IL

DESCRIBE DAMAGE: Front driver side door crushed, front quarter panel damaged, airbags deployed, window shattered
ESTIMATE AMOUNT: $18,500

OTHER VEHICLE DAMAGED
YEAR: 2019
MAKE: Ford
MODEL: F-150
DRIVER'S NAME: Sarah Johnson
PHONE: (555) 987-6543

POLICE DEPARTMENT CONTACTED: Springfield Police Department
REPORT NUMBER: SPD-2024-5678`;
    processDocument(sampleText);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">Insurance Claims Processing Agent</h1>
          </div>
          <p className="text-gray-600 mb-6">
            Upload an FNOL (First Notice of Loss) document for automated extraction, validation, and routing.
          </p>
          <div className="flex gap-4 mb-6">
            <label className="flex-1 cursor-pointer">
              <div className="border-2 border-dashed border-indigo-300 rounded-lg p-6 hover:border-indigo-500 transition-colors bg-indigo-50">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-600">
                    {file ? file.name : 'Upload FNOL Document'}
                  </span>
                  <span className="text-xs text-gray-500">TXT or PDF format</span>
                </div>
              </div>
              <input type="file" className="hidden" accept=".txt,.pdf" onChange={handleFileUpload} />
            </label>
            <button onClick={loadSampleFNOL} className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              Load Sample FNOL
            </button>
          </div>
          {processing && (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="text-gray-600">Processing document...</span>
            </div>
          )}
        </div>
        {result && !processing && (
          <div className="space-y-6">
            <div className={`bg-white rounded-lg shadow-xl p-6 border-2 ${getRouteColor(result.recommendedRoute)}`}>
              <div className="flex items-center gap-4 mb-4">
                {getRouteIcon(result.recommendedRoute)}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Recommended Route: {result.recommendedRoute}
                  </h2>
                  <p className="text-gray-600 mt-1">{result.reasoning}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Extracted Fields</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(result.extractedFields).map(([key, value]) => (
                  <div key={key} className="border border-gray-200 rounded p-3">
                    <div className="text-sm text-gray-500 font-medium capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div className="text-gray-800 font-medium mt-1">
                      {value !== null && value !== '' ? String(value) : (
                        <span className="text-red-500">Not Found</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {result.missingFields.length > 0 && (
              <div className="bg-white rounded-lg shadow-xl p-6 border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  Missing Mandatory Fields ({result.missingFields.length})
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {result.missingFields.map((field, idx) => (
                    <li key={idx} className="text-gray-700">{field}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="bg-white rounded-lg shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">JSON Output</h3>
              <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsuranceClaimsAgent;
