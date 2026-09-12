# Confidential Computing & Trusted Execution Environment (TEE) Architecture
## Technical Specification & Statutory Trade Secret Protection for Ayurvedic Formulations

**Platform:** Nyaaya AI (IP-SAKTI)  
**Classification:** Enterprise Architecture Specification  
**Version:** 1.0 (Production Release)  
**Date:** September 2026  

---

### Executive Summary

In Ayurvedic, phytopharmaceutical, and ASU (Ayurveda, Siddha, Unani) product commercialisation, proprietary herbal formulations often involve multi-component synergistic combinations, specific extraction solvent protocols (e.g., supercritical CO2 at precise bar pressures, hydro-ethanolic reflux), and standardized bioactive concentration percentages (e.g., 5.5% withaferin A or 45% total withanolides).

Under **The Patents Act, 1970 (§29–34)**, premature or unshielded exposure of an invention prior to filing an official patent application with the Indian Patent Office (IPO) **destroys novelty**, legally precluding patent grant and creating accidental prior art against the innovator.

To provide pharmaceutical enterprises, startups, and Ayurvedic Vaidyas with mathematical assurance that their intellectual property remains strictly confidential, Nyaaya AI implements a four-tiered **Confidential Computing & Trusted Execution Environment (TEE)** architecture with **Zero Data Retention (ZDR)**.

---

### 1. Threat Model & Risk Vectors

| Risk Vector | Threat Description | Conventional AI Risk | Nyaaya AI TEE Mitigation |
|---|---|---|---|
| **Data in Transit** | Interception of payload between browser and API edge | Plaintext transmission, TLS termination at intermediate proxies | TLS 1.3 only with client-side field-level pre-masking |
| **Data in Use** | AI model weights, host OS, hypervisor, or cloud admins inspecting GPU VRAM | Cloud provider hypervisors have root memory access; model providers cache prompts | Hardware memory encryption (AMD SEV-SNP / AWS Nitro Enclaves); volatile memory execution only |
| **Data at Rest** | Database administrators, compromised DB backups, or multi-tenant leaks | Prompts, formulation ingredients, and chat histories stored in PostgreSQL | **Zero Database Retention Mode**: 0 bytes written to disk or database tables |
| **Model Retraining** | Frontier LLM providers utilizing queries for continuous model training | Enterprise formulation data leaking into public weights of next-generation LLMs | Enforced Zero Data Retention (ZDR) contracts; prompt caching flags explicitly disabled |
| **Accidental Prior Art** | Public or third-party disclosure destroys novelty under Patents Act §29–34 | Invalidation of patentability before provisional application is filed | Ephemeral execution with cryptographic certificate of confidential processing |

---

### 2. Multi-Layer Confidential Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: CLIENT BROWSER                         │
│  • Client-Side Privacy Shield: Web Crypto SHA-256 Digest              │
│  • Automatic Proportional & Ratio Masking Regex Engine                │
│  • Local Memory State (SessionStorage / React State only)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (TLS 1.3)
                                    │ Payload + `confidential_mode: true`
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  LAYER 2: SUPABASE EDGE FUNCTION GATEWAY               │
│  • Zero-Retention Gate: Complete bypass of `messages`/`conversations` │
│  • Strict In-Memory Ephemeral Request Lifecycle                        │
│  • Dynamic SHA-256 Receipt Generator with cryptographic audit token   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ mTLS Attested Channel
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 LAYER 3: HARDWARE TEE / ZDR MODEL ENCLAVE              │
│  • Hardware Memory Encryption (AMD SEV-SNP / AWS Nitro Enclave)        │
│  • Zero-Data-Retention (ZDR) Enterprise Upstream Contract              │
│  • No persistent logs, no prompt caching, no disk swap                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Clean Statutory Analysis +
                                    │ Cryptographic ZDR Receipt
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 LAYER 4: VERIFICATION & AUDIT RECEIPT                  │
│  • User receives Certificate of Confidential Processing (JSON/PDF)     │
│  • Exact SHA-256 input digest verified against returned receipt        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Layer 1: Client-Side Proportional Masking (Privacy Shield)

The primary trade secret in herbal formulation patents is almost never the generic names of the plants (which are often common heritage), but the **exact ratios, solvent concentrations, and purification thresholds**.

The Nyaaya AI Privacy Shield runs entirely client-side using JavaScript RegExp and Web Crypto API before the HTTP request leaves the browser:

1. **Extraction Concentration Masking**:
   - `Withania somnifera (45% w/w)` $\rightarrow$ `Withania somnifera [RATIO_1]`
   - `Piper nigrum (extract standardized to 95% piperine)` $\rightarrow$ `Piper nigrum (extract standardized to [CONCENTRATION_2])`
2. **Solvent & Extraction Process Masking**:
   - `supercritical CO2 at 320 bar` $\rightarrow$ `supercritical CO2 at [PRESSURE_PARAM]`
   - `hydro-alcoholic 70:30 v/v` $\rightarrow$ `hydro-alcoholic [SOLVENT_RATIO]`
3. **Statutory Preservation**:
   - The statutory legal rules (Section 3(p) for traditional knowledge, Section 3(e) for mere admixture, Biological Diversity Act §3/§4 for foreign vs. domestic access) depend on **botanical origin and innovative character**, NOT the exact proprietary milligram ratio. Thus, legal classification remains 100% accurate while zero commercial secret is disclosed!

---

### 4. Layer 2: Zero Data Retention (ZDR) Gateway

When `confidential_mode: true` is supplied to Edge Functions (`ask-query` or `classify-formulation`):
1. **DB Bypass**: The database insertion query (`supabase.from('messages').insert(...)`) is short-circuited.
2. **Stateless Processing**: The query and formulation details reside only in Deno runtime RAM for the duration of the HTTP connection.
3. **Receipt Generation**:
   The gateway computes a deterministic receipt:
   ```json
   {
     "receipt_id": "zdr_rec_8f3d1b942e...",
     "timestamp": "2026-09-12T15:45:00.000Z",
     "mode": "tee_zero_retention",
     "enclave_spec": "AMD-SEV-SNP / AWS Nitro Enclave compatible",
     "data_retention": "0ms (memory-only, 0 bytes written to disk)",
     "payload_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
     "verified": true
   }
   ```

---

### 5. Layer 3: Hardware Enclave & LLM Confidentiality

In production deployment:
- Enclave workloads are isolated inside **AWS Nitro Enclaves** or **GCP Confidential VMs** (powered by AMD SEV-SNP).
- Enclave characteristics:
  - No interactive access (no SSH, no root user, no logging daemon).
  - CPU hardware memory encryption keys are generated randomly by the AMD Secure Processor and never exposed to the host operating system.
  - Upstream LLM provider calls enforce Zero Data Retention (ZDR) enterprise service terms, disabling all human review and model training datasets.

---

### 6. Compliance with Statutory & Regulatory Frameworks

1. **The Patents Act, 1970 (Section 29–34 — Anticipation & Novelty)**:
   Confidential TEE processing prevents public disclosure, safeguarding the priority date of the applicant under Indian and PCT international filings.
2. **The Biological Diversity Act, 2002 & 2023 Amendments**:
   Research queries regarding wild-harvested Indian biological resources can be analyzed without exposing supply chains or local community source locations prematurely.
3. **ISO/IEC 27001 & SOC 2 Type II**:
   Aligns with Confidentiality, Integrity, and Non-repudiation criteria for enterprise SaaS deployments.
