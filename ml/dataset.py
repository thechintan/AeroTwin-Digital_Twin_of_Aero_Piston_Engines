import numpy as np
import pandas as pd
import os
import json

# ══════════════════════════════════════════════════════════════════════════
# MALE UAV Aero-Piston Engine Telemetry Dataset Generator
# Generates synthetic NGAFID-style flight sensor data for predictive
# maintenance / digital twin training.
# ══════════════════════════════════════════════════════════════════════════

FEATURES = [
    'rpm', 'throttle_pct', 'manifold_pressure',
    'cht_1', 'cht_2', 'cht_3', 'cht_4',
    'egt_1', 'egt_2', 'egt_3', 'egt_4',
    'fuel_flow', 'fuel_pressure', 'injection_timing_deg',
    'oil_pressure', 'oil_temp',
    'coolant_temp',
    'vib_x', 'vib_y', 'vib_z', 'vib_rms',
    'battery_voltage', 'alternator_current',
    'airspeed_kts', 'altitude_ft', 'ambient_temp_c'
]

FAULT_CLASSES = [
    'NOMINAL', 'CYLINDER_MISFIRE', 'INJECTOR_CLOGGING',
    'COOLING_DEGRADATION', 'LUBRICATION_FAILURE',
    'SENSOR_DRIFT', 'COMBUSTION_INSTABILITY'
]

def generate_nominal(n):
    """Generate nominal engine telemetry."""
    data = {
        'rpm': np.random.normal(4600, 200, n),
        'throttle_pct': np.random.uniform(40, 95, n),
        'manifold_pressure': np.random.normal(26.5, 2.0, n),
        'cht_1': np.random.normal(190, 12, n),
        'cht_2': np.random.normal(195, 12, n),
        'cht_3': np.random.normal(192, 12, n),
        'cht_4': np.random.normal(188, 12, n),
        'egt_1': np.random.normal(1320, 40, n),
        'egt_2': np.random.normal(1340, 40, n),
        'egt_3': np.random.normal(1310, 40, n),
        'egt_4': np.random.normal(1325, 40, n),
        'fuel_flow': np.random.normal(12.5, 1.5, n),
        'fuel_pressure': np.random.normal(35, 3, n),
        'injection_timing_deg': np.random.normal(22, 1.5, n),
        'oil_pressure': np.random.normal(58, 5, n),
        'oil_temp': np.random.normal(190, 10, n),
        'coolant_temp': np.random.normal(180, 8, n),
        'vib_x': np.random.normal(0.8, 0.3, n),
        'vib_y': np.random.normal(0.7, 0.3, n),
        'vib_z': np.random.normal(1.0, 0.4, n),
        'vib_rms': np.random.normal(1.5, 0.5, n),
        'battery_voltage': np.random.normal(28.2, 0.5, n),
        'alternator_current': np.random.normal(45, 5, n),
        'airspeed_kts': np.random.normal(120, 15, n),
        'altitude_ft': np.random.normal(15000, 3000, n),
        'ambient_temp_c': np.random.normal(25, 8, n),
    }
    return data

def inject_fault(data, fault_type, n):
    """Inject fault signatures into nominal data."""
    if fault_type == 'CYLINDER_MISFIRE':
        data['cht_2'] = np.random.normal(260, 20, n)
        data['egt_2'] = np.random.normal(1580, 50, n)
        data['vib_rms'] = np.random.normal(3.5, 0.8, n)
        data['rpm'] = np.random.normal(4200, 300, n)
    elif fault_type == 'INJECTOR_CLOGGING':
        data['fuel_flow'] = np.random.normal(8.5, 1.0, n)
        data['fuel_pressure'] = np.random.normal(22, 3, n)
        data['injection_timing_deg'] = np.random.normal(28, 3, n)
        data['egt_3'] = np.random.normal(1520, 60, n)
    elif fault_type == 'COOLING_DEGRADATION':
        data['coolant_temp'] = np.random.normal(240, 15, n)
        data['cht_1'] = np.random.normal(260, 15, n)
        data['cht_2'] = np.random.normal(265, 15, n)
        data['cht_3'] = np.random.normal(258, 15, n)
        data['cht_4'] = np.random.normal(255, 15, n)
        data['oil_temp'] = np.random.normal(230, 12, n)
    elif fault_type == 'LUBRICATION_FAILURE':
        data['oil_pressure'] = np.random.normal(28, 5, n)
        data['oil_temp'] = np.random.normal(250, 15, n)
        data['vib_rms'] = np.random.normal(4.0, 1.0, n)
        data['vib_z'] = np.random.normal(3.5, 0.8, n)
    elif fault_type == 'SENSOR_DRIFT':
        data['battery_voltage'] = np.random.normal(24.0, 2.0, n)
        data['alternator_current'] = np.random.normal(30, 8, n)
        data['cht_1'] = data['cht_1'] + np.linspace(0, 40, n)
    elif fault_type == 'COMBUSTION_INSTABILITY':
        data['manifold_pressure'] = np.random.normal(20, 4, n)
        data['egt_1'] = np.random.normal(1480, 80, n)
        data['egt_2'] = np.random.normal(1500, 80, n)
        data['vib_rms'] = np.random.normal(3.2, 0.9, n)
        data['rpm'] = np.random.normal(4100, 400, n)
    return data

def generate_dataset(total_samples=3000, output_dir=None):
    """Generate full labeled dataset with fault injection."""
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(__file__), '..', 'ml_artifacts')
    os.makedirs(output_dir, exist_ok=True)

    nominal_pct = 0.55
    n_nominal = int(total_samples * nominal_pct)
    n_fault_each = (total_samples - n_nominal) // (len(FAULT_CLASSES) - 1)

    all_rows = []

    # Nominal
    nom_data = generate_nominal(n_nominal)
    df_nom = pd.DataFrame(nom_data)
    df_nom['fault_class'] = 'NOMINAL'
    df_nom['rul_hours'] = np.random.uniform(800, 2000, n_nominal)
    df_nom['degradation'] = np.random.uniform(0.0, 0.1, n_nominal)
    all_rows.append(df_nom)

    # Faults
    for fault in FAULT_CLASSES[1:]:
        fault_data = generate_nominal(n_fault_each)
        fault_data = inject_fault(fault_data, fault, n_fault_each)
        df_f = pd.DataFrame(fault_data)
        df_f['fault_class'] = fault
        df_f['rul_hours'] = np.random.uniform(50, 500, n_fault_each)
        df_f['degradation'] = np.random.uniform(0.3, 0.9, n_fault_each)
        all_rows.append(df_f)

    df = pd.concat(all_rows, ignore_index=True).sample(frac=1.0, random_state=42).reset_index(drop=True)

    # Derived columns
    df['cht_avg'] = df[['cht_1', 'cht_2', 'cht_3', 'cht_4']].mean(axis=1)
    df['egt_spread'] = df[['egt_1', 'egt_2', 'egt_3', 'egt_4']].max(axis=1) - df[['egt_1', 'egt_2', 'egt_3', 'egt_4']].min(axis=1)

    csv_path = os.path.join(output_dir, 'male_uav_engine_telemetry.csv')
    df.to_csv(csv_path, index=False)
    print(f"[DATASET] Generated {len(df)} samples → {csv_path}")
    return df, csv_path

if __name__ == '__main__':
    generate_dataset()
