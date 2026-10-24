---
name: Local Model Benchmark
command: /bench
version: "1.0"
category: IOTA tools
editions: both
editions_reason: "Works in both editions. It sends test prompts to the model server running on your own PC and reads memory use from local system tools. Nothing leaves the machine."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /bench: Local Model Benchmark

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Measure how a local model actually performs on your PC: time to first token (TTFT), generation speed in tokens per second, prompt processing speed, and VRAM and RAM use. Then recommend which model size and settings fit your hardware for chat, documents, and code.

## When to use

- Choosing between Gemma 3 4B, 12B, and 27B, or a Nemotron model, on your hardware.
- After a driver update or settings change, to see if speed changed.
- Explaining to someone else what hardware a given model needs.

## When not to use

- Comparing answer quality. Speed and memory are measured here; quality needs your own test questions.
- While other heavy programs (games, renders) are running. Results will be low and noisy.

## Requirements

- A local model server with an OpenAI compatible streaming endpoint on your PC, for example llama.cpp `llama-server` at `http://127.0.0.1:8080/v1`. Set the address to whatever your local server uses.
- Python 3.10 or later with `requests` and `psutil`.
- NVIDIA GPUs: `nvidia-smi` (installed with the driver). AMD GPUs on Windows: the skill reads dedicated GPU memory from Windows performance counters; on Linux, `rocm-smi`. If no reader is available, VRAM is reported as unknown.
- The model being tested does not need to be large; the skill itself runs fine with any model because the measurements are made by the script.

## Inputs

| Input | Required | Default |
|---|---|---|
| Endpoint | No | `http://127.0.0.1:8080/v1` |
| Model names | No | the model currently loaded |
| Prompt sizes | No | 128, 1024, 4096 tokens (approximate) |
| Output length | No | 256 tokens |
| Runs per test | No | 3 (plus 1 warm up) |

## Step-by-step procedure

1. **Check the server.** `GET {endpoint}/models` and list models. If it fails, tell the user how to start their local server; do not try to install anything.

2. **Record the system.** CPU, core count, RAM, GPU name and VRAM, OS, and the server's context size and GPU layer settings if the user knows them.
   ```python
   import platform, psutil, subprocess, shutil

   def system_info() -> dict:
       info = {"os": platform.platform(), "cpu": platform.processor(),
               "cores": psutil.cpu_count(logical=False), "ram_gb": round(psutil.virtual_memory().total / 2**30, 1)}
       if shutil.which("nvidia-smi"):
           out = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,memory.used",
                                 "--format=csv,noheader,nounits"], capture_output=True, text=True).stdout
           name, total, used = [x.strip() for x in out.splitlines()[0].split(",")]
           info.update(gpu=name, vram_total_mb=int(total), vram_used_mb=int(used))
       return info
   ```

3. **Build prompts of known size.** Repeat a neutral paragraph until the server's token count reaches the target. If the server has a `/tokenize` endpoint (llama.cpp does, at the root path, not under `/v1`), use it; otherwise estimate 4 characters per token and report sizes as approximate.

4. **Measure with streaming.** TTFT is the time from sending the request to the first content token. Generation speed is tokens after the first divided by the time after the first token.
   ```python
   import json, time, requests

   def run_once(endpoint: str, model: str, prompt: str, max_tokens: int = 256) -> dict:
       body = {"model": model, "stream": True, "max_tokens": max_tokens, "temperature": 0,
               "messages": [{"role": "user", "content": prompt}],
               "stream_options": {"include_usage": True}}
       t0 = time.perf_counter(); first = None; n = 0; usage = None
       with requests.post(f"{endpoint}/chat/completions", json=body, stream=True, timeout=600) as r:
           r.raise_for_status()
           for line in r.iter_lines():
               if not line or not line.startswith(b"data: "):
                   continue
               data = line[6:]
               if data == b"[DONE]":
                   break
               chunk = json.loads(data)
               if chunk.get("usage"):
                   usage = chunk["usage"]
               for ch in chunk.get("choices", []):
                   if ch.get("delta", {}).get("content"):
                       if first is None:
                           first = time.perf_counter()
                       n += 1
       t1 = time.perf_counter()
       gen_tokens = (usage or {}).get("completion_tokens", n)
       prompt_tokens = (usage or {}).get("prompt_tokens")
       ttft = (first - t0) if first else None
       tps = (gen_tokens - 1) / (t1 - first) if first and t1 > first and gen_tokens > 1 else None
       return {"ttft_s": ttft, "gen_tps": tps, "gen_tokens": gen_tokens, "prompt_tokens": prompt_tokens,
               "prompt_tps": (prompt_tokens / ttft) if prompt_tokens and ttft else None}
   ```
   Streamed chunks usually carry one token each, so the chunk count `n` is a fallback when the server does not report usage.

5. **Sample memory during the run.** In a background thread, read `nvidia-smi --query-gpu=memory.used` every 0.5 seconds and the server process RSS with `psutil` (find it by name, for example `llama-server`). Report the peak.

6. **Repeat.** One warm up run (not counted), then 3 runs per prompt size. Report the median and the spread (min to max).

7. **Recommend.** Rules of thumb the skill applies and explains:
   - Under 5 tokens per second feels slow for chat; 10 or more feels comfortable; 20 or more is fast.
   - TTFT over 10 seconds on a 4K prompt means long documents will feel sluggish; suggest a smaller model or fewer context tokens.
   - If VRAM peak is within 5 percent of total, the server is probably spilling to system RAM; suggest a smaller quantization (for example Q4_K_M instead of Q8_0) or a smaller context size.
   - Typical fits at 4 bit quantization: Gemma 3 4B in about 4 GB of VRAM, 12B in about 8 to 10 GB, 27B in about 16 to 20 GB, plus context. These are estimates; the measured peak is what counts.

## Output format

```
/bench results  (Gemma 3 12B Q4_K_M, llama-server, RTX 4070 12 GB, 32 GB RAM)
prompt   TTFT      prompt tok/s   gen tok/s   VRAM peak   RAM peak (server)
~128     0.21 s    610            38.4        8.9 GB      1.2 GB
~1024    0.95 s    1080           36.9        9.2 GB      1.2 GB
~4096    3.80 s    1080           33.1        10.1 GB     1.3 GB
Recommendation: comfortable for chat and long documents. 27B would not fit in VRAM.
```
Saved as `bench_<model>_<date>.csv` and `.md`. The numbers above illustrate the format only.

## Safety and confirmation rules

- Only talks to a server address on the local machine (`127.0.0.1`, `localhost`, or a LAN address the user gives). It does not send prompts to cloud services.
- Does not start, stop, or reconfigure the model server; it suggests settings and the user applies them.
- Never overwrites earlier results; files are dated.
- Nothing is uploaded or posted.

## Quality checks

- Warm up excluded; at least 3 measured runs.
- If the spread is more than 20 percent of the median, the skill flags noisy results and suggests closing other programs.
- Token counts come from the server when available; otherwise marked approximate.

## Examples

1. Single model: Gemma 3 4B on a laptop GPU with 6 GB; fast generation, recommendation to use it for everyday tasks and 12B only for short prompts.
2. Comparison: Gemma 3 12B versus a Nemotron model of similar size on the same PC; table side by side, same prompts.
3. CPU only: no GPU reader found, VRAM shown as unknown; RAM peak and speed reported, with a note that 4B is the practical size.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Connection refused | The local server is not running or uses another port. |
| `gen_tps` empty | The server does not stream content tokens; check that streaming is enabled. |
| VRAM unknown | Install the vendor tool or read Task Manager's Performance tab manually. |
| First run much slower | Normal; that is why there is a warm up run. |

## Limitations

- Speed depends on quantization, context size, drivers, and background load.
- Memory readings are sampled every 0.5 seconds and can miss short peaks.
- Quality is not measured.

## Changelog

- 1.0 (October 2026): First release. Streaming TTFT and tokens per second, prompt processing speed, VRAM and RAM peaks, recommendations.
