"""Train a tiny MLP on the synthetic looming-response data
(generate_looming_training_data.py) and export its weights for in-browser
inference (frontend/src/loomingPerception.ts).

Plain numpy forward/backward gradient descent (Adam) -- no torch/sklearn
in tools/pyproject.toml, and a 3-8-2 network on ~20k samples doesn't need
either. The network itself is genuinely tiny: 3 inputs (normalized
distance, closing speed, bearing) -> 8 hidden (tanh) -> 2 outputs
(sigmoid, left/right wing drive in [0,1]).

Run with: uv run python train_looming_response.py
(after: uv run python generate_looming_training_data.py)
"""

import json

import numpy as np

DATA_PATH = "looming_training_data.json"
OUTPUT_PATH = "../frontend/src/assets/looming-model.json"

HIDDEN_UNITS = 8
LEARNING_RATE = 0.02
EPOCHS = 4000
VAL_FRACTION = 0.1
RNG_SEED = 11


def normalize_inputs(inputs, detection_range_mm, max_closing_speed_mm_s, fov_half_angle_rad):
    distance, closing_speed, bearing = inputs[:, 0], inputs[:, 1], inputs[:, 2]
    return np.stack(
        [
            np.clip(distance / detection_range_mm, 0.0, 1.0),
            np.clip(closing_speed / max_closing_speed_mm_s, -1.0, 1.0),
            np.clip(bearing / fov_half_angle_rad, -1.0, 1.0),
        ],
        axis=1,
    )


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


class AdamState:
    def __init__(self, shape):
        self.m = np.zeros(shape)
        self.v = np.zeros(shape)

    def step(self, param, grad, t, lr, beta1=0.9, beta2=0.999, eps=1e-8):
        self.m = beta1 * self.m + (1 - beta1) * grad
        self.v = beta2 * self.v + (1 - beta2) * (grad**2)
        m_hat = self.m / (1 - beta1**t)
        v_hat = self.v / (1 - beta2**t)
        return param - lr * m_hat / (np.sqrt(v_hat) + eps)


def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    inputs = np.array(data["inputs"])
    targets = np.array(data["targets"])
    x = normalize_inputs(inputs, data["detectionRangeMm"], data["maxClosingSpeedMmS"], data["fovHalfAngleRad"])

    rng = np.random.default_rng(RNG_SEED)
    n = x.shape[0]
    perm = rng.permutation(n)
    n_val = int(n * VAL_FRACTION)
    val_idx, train_idx = perm[:n_val], perm[n_val:]
    x_train, y_train = x[train_idx], targets[train_idx]
    x_val, y_val = x[val_idx], targets[val_idx]

    n_in, n_hidden, n_out = 3, HIDDEN_UNITS, 2
    w1 = rng.normal(0, 1 / np.sqrt(n_in), (n_in, n_hidden))
    b1 = np.zeros(n_hidden)
    w2 = rng.normal(0, 1 / np.sqrt(n_hidden), (n_hidden, n_out))
    b2 = np.zeros(n_out)

    adam = {name: AdamState(param.shape) for name, param in [("w1", w1), ("b1", b1), ("w2", w2), ("b2", b2)]}

    for epoch in range(1, EPOCHS + 1):
        h_pre = x_train @ w1 + b1
        h = np.tanh(h_pre)
        out_pre = h @ w2 + b2
        pred = sigmoid(out_pre)

        error = pred - y_train  # d(MSE)/d(pred) up to the 2/n constant folded into d_out below
        n_batch = x_train.shape[0]
        d_out = error * pred * (1 - pred) * (2.0 / n_batch)  # sigmoid derivative, MSE grad
        grad_w2 = h.T @ d_out
        grad_b2 = d_out.sum(axis=0)

        d_hidden = (d_out @ w2.T) * (1 - h**2)  # tanh derivative
        grad_w1 = x_train.T @ d_hidden
        grad_b1 = d_hidden.sum(axis=0)

        w1 = adam["w1"].step(w1, grad_w1, epoch, LEARNING_RATE)
        b1 = adam["b1"].step(b1, grad_b1, epoch, LEARNING_RATE)
        w2 = adam["w2"].step(w2, grad_w2, epoch, LEARNING_RATE)
        b2 = adam["b2"].step(b2, grad_b2, epoch, LEARNING_RATE)

        if epoch % 500 == 0 or epoch == EPOCHS:
            train_mse = np.mean((pred - y_train) ** 2)
            val_h = np.tanh(x_val @ w1 + b1)
            val_pred = sigmoid(val_h @ w2 + b2)
            val_mse = np.mean((val_pred - y_val) ** 2)
            print(f"epoch {epoch:5d}  train_mse={train_mse:.6f}  val_mse={val_mse:.6f}")

    with open(OUTPUT_PATH, "w") as f:
        json.dump(
            {
                "detectionRangeMm": data["detectionRangeMm"],
                "maxClosingSpeedMmS": data["maxClosingSpeedMmS"],
                "fovHalfAngleRad": data["fovHalfAngleRad"],
                "w1": w1.tolist(),
                "b1": b1.tolist(),
                "w2": w2.tolist(),
                "b2": b2.tolist(),
            },
            f,
        )
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
