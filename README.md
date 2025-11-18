# Interactive Data Deal Explorer

A web application to browse documented AI data deals from the NeurIPS 2025 paper **"A Sustainable AI Economy Needs Data Deals That Work for Generators"**.

This tool provides an interactive explorer for publicly reported data deals, featuring network visualizations, filterable data tables, and crowd-sourced additions.

[Paper](https://openreview.net/pdf?id=mdKzkjY1dM) | [NeurIPS Poster](https://neurips.cc/virtual/2025/loc/san-diego/poster/121926) | [Video](https://recorder-v3.slideslive.com/?share=107281&s=9746fb43-083d-4e57-a960-15a4e3fb26d8) | [Slides](https://docs.google.com/presentation/d/1gk3LhmmyvB9qs5wWdLMOdmmoGd7u2LDO-vnSBN89MBQ/edit?usp=sharing)

<details>
<summary><strong>Paper summary</strong></summary>

We argue that the machine learning value chain is structurally unsustainable due to an economic data processing inequality: each state in the data cycle from inputs to model weights to synthetic outputs refines technical signal but strips economic equity from data generators. We show, by analyzing seventy-three public data deals, that the majority of value accrues to aggregators, with documented creator royalties rounding to zero and widespread opacity of deal terms. This is not just an economic welfare concern: as data and its derivatives become economic assets, the feedback loop that sustains current learning algorithms is at risk. We identify three structural faults - missing provenance, asymmetric bargaining power, and non-dynamic pricing - as the operational machinery of this inequality. In our analysis, we trace these problems along the machine learning value chain and propose an Equitable Data-Value Exchange (EDVEX) Framework to enable a minimal market that benefits all participants. Finally, we outline research directions where our community can make concrete contributions to data deals and contextualize our position with related and orthogonal viewpoints.

</details>


## How to Use This Tool

1. **Use the hosted version**: Visit [https://research.brickroad.network/neurips2025-data-deals](https://research.brickroad.network/neurips2025-data-deals) to explore and edit data deals interactively.

2. **Run locally**: See the [Setup Checklist](docs/SETUP_CHECKLIST.md) for local development instructions.

## Project Structure

```text
data-deals/
├── app/                    # Next.js application (pages, API routes)
├── components/             # React components
├── data/                   # Deal data and the raw paper LaTeX
├── docs/                   # Documentation
├── lib/                    # Shared utilities
├── prisma/                 # Database schema
├── scripts/                # Build & deployment scripts
└── public/                 # Static assets
```

For detailed technical documentation, see [docs/README.md](docs/README.md).

## Citation

If you use this tool or reference the data deals dataset, we appreciate if you cite the paper:

```bibtex
@inproceedings{
    jia2025a,
    title={A Sustainable {AI} Economy Needs Data Deals That Work for Generators},
    author={Ruoxi Jia and Luis Oala and Wenjie Xiong and Suqin Ge and Jiachen T. Wang and Feiyang Kang and Dawn Song},
    booktitle={The Thirty-Ninth Annual Conference on Neural Information Processing Systems Position Paper Track},
    year={2025},
    url={https://openreview.net/forum?id=mdKzkjY1dM}
}
```

## License

Apache License 2.0
