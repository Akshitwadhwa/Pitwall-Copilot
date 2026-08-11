# Pitwall Copilot

Pitwall Copilot is the F1 radio-assistance prototype: a guided cockpit experience followed by a two-way Driver Radio / Engineer Radio workspace.

## Run the frontend

```bash
npm install
npm run dev
```

## Run the radio API

In a second terminal:

```bash
npm run server
```

The frontend proxies `/api` requests to `http://127.0.0.1:8787`. Without the API running, the UI keeps a local demo fallback so the interaction remains usable.

## Hugging Face integration

The reference examples live in `data/f1-radio-examples.json`. The API retrieves the closest example and formats the response into the approved communication schema. If `HF_API_TOKEN` is present, low-similarity messages are sent to `facebook/bart-large-mnli` through the Hugging Face Inference API:

```bash
HF_API_TOKEN=your_token npm run server
```

The driver-facing output remains constrained to approved, short phrases; the model never writes an unconstrained instruction directly to the driver display.
