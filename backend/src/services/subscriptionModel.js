/**
 * Logistic regression classifier for subscription detection.
 *
 * Runs alongside the heuristic scorer in subscriptionEngine.js.
 * Returns a confidence in [0, 1]. When both scores are available,
 * the engine takes the higher of the two (conservative = don't miss real subs).
 *
 * Weights are stored in src/model/weights.json and should be retrained
 * periodically using feedback collected via POST /subscriptions/:id/feedback.
 */

import { createRequire } from 'module';
import { extractFeatures } from './modelFeatures.js';

const require = createRequire(import.meta.url);
let _model = null;

function loadModel() {
  if (_model) return _model;
  try {
    _model = require('../model/weights.json');
  } catch {
    _model = null;
  }
  return _model;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Predict subscription probability for a candidate email.
 *
 * @param {{ subject, from, snippet, senderDomain, amount, bodyText? }} candidate
 * @returns {{ confidence: number, features: number[] } | null}
 *   Returns null if the model file isn't loaded (graceful degradation).
 */
export function predictSubscription(candidate) {
  const model = loadModel();
  if (!model?.weights?.length) return null;

  const features = extractFeatures(candidate);
  const { weights, bias } = model;

  let logit = bias;
  for (let i = 0; i < weights.length; i++) {
    logit += (weights[i] || 0) * (features[i] || 0);
  }

  return {
    confidence: sigmoid(logit),
    features,
  };
}

/**
 * Given a set of labeled examples, compute updated weights via gradient descent.
 * This is a lightweight online update — not a full retrain.
 *
 * Call after collecting enough feedback labels to make a meaningful update.
 *
 * @param {Array<{ features: number[], label: 1 | 0 }>} examples
 * @param {{ learningRate?: number, epochs?: number }} opts
 * @returns {{ weights: number[], bias: number }}
 */
export function updateWeights(examples, { learningRate = 0.01, epochs = 100 } = {}) {
  const model = loadModel();
  if (!model) throw new Error('Model not loaded');

  let weights = [...model.weights];
  let bias    = model.bias;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const { features, label } of examples) {
      let logit = bias;
      for (let i = 0; i < weights.length; i++) logit += weights[i] * features[i];
      const pred  = sigmoid(logit);
      const error = pred - label;

      for (let i = 0; i < weights.length; i++) {
        weights[i] -= learningRate * error * features[i];
      }
      bias -= learningRate * error;
    }
  }

  return { weights, bias };
}
