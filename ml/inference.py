import os, sys, json, pickle
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from dataset import FEATURES, FAULT_CLASSES

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'ml_artifacts')

class ModelPipeline:
    def __init__(self, artifacts_dir=ARTIFACTS_DIR):
        self.clf = pickle.load(open(os.path.join(artifacts_dir, 'fault_classifier.pkl'), 'rb'))
        self.reg = pickle.load(open(os.path.join(artifacts_dir, 'rul_regressor.pkl'), 'rb'))
        self.iso = pickle.load(open(os.path.join(artifacts_dir, 'anomaly_detector.pkl'), 'rb'))
        self.scaler = pickle.load(open(os.path.join(artifacts_dir, 'scaler.pkl'), 'rb'))
        print("[INFERENCE] Models loaded successfully")

    def predict(self, sensor_dict):
        """Run full inference pipeline on a single sensor reading."""
        vec = np.array([[sensor_dict.get(f, 0.0) for f in FEATURES]])
        scaled = self.scaler.transform(vec)

        fault_idx = int(self.clf.predict(scaled)[0])
        fault_probs = self.clf.predict_proba(scaled)[0]
        fault_class = FAULT_CLASSES[fault_idx]

        rul_hours = float(self.reg.predict(scaled)[0])
        anomaly_score = float(self.iso.decision_function(scaled)[0])
        is_anomaly = bool(self.iso.predict(scaled)[0] == -1)

        # Engine Health Index
        ehi = max(0, min(100, 96.5 - (0.05 if fault_class == 'NOMINAL' else 15 + np.random.uniform(0, 10))))

        return {
            'fault_class': fault_class,
            'fault_probabilities': {FAULT_CLASSES[i]: round(float(fault_probs[i]), 4) for i in range(len(FAULT_CLASSES))},
            'rul_hours': round(max(0, rul_hours), 1),
            'anomaly_score': round(anomaly_score, 4),
            'is_anomaly': is_anomaly,
            'ehi': round(ehi, 1),
            'degradation': round(max(0, 1.0 - ehi / 100.0), 3)
        }

def generate_live_sensor():
    """Generate a single realistic live sensor reading."""
    return {
        'rpm': np.random.normal(4600, 180),
        'throttle_pct': np.random.uniform(50, 90),
        'manifold_pressure': np.random.normal(26.5, 1.8),
        'cht_1': np.random.normal(192, 10), 'cht_2': np.random.normal(196, 10),
        'cht_3': np.random.normal(190, 10), 'cht_4': np.random.normal(189, 10),
        'egt_1': np.random.normal(1325, 35), 'egt_2': np.random.normal(1340, 35),
        'egt_3': np.random.normal(1315, 35), 'egt_4': np.random.normal(1330, 35),
        'fuel_flow': np.random.normal(12.5, 1.2),
        'fuel_pressure': np.random.normal(35, 2.5),
        'injection_timing_deg': np.random.normal(22, 1.2),
        'oil_pressure': np.random.normal(58, 4),
        'oil_temp': np.random.normal(190, 8),
        'coolant_temp': np.random.normal(180, 6),
        'vib_x': np.random.normal(0.8, 0.25), 'vib_y': np.random.normal(0.7, 0.25),
        'vib_z': np.random.normal(1.0, 0.3), 'vib_rms': np.random.normal(1.5, 0.4),
        'battery_voltage': np.random.normal(28.2, 0.4),
        'alternator_current': np.random.normal(45, 4),
        'airspeed_kts': np.random.normal(120, 12),
        'altitude_ft': np.random.normal(15000, 2000),
        'ambient_temp_c': np.random.normal(25, 6),
    }

if __name__ == '__main__':
    pipeline = ModelPipeline()
    sensor = generate_live_sensor()
    result = pipeline.predict(sensor)
    output = {'sensor': {k: round(v, 2) for k, v in sensor.items()}, 'prediction': result}
    print(json.dumps(output, indent=2))
