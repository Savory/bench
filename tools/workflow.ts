import { join, stringify } from "./deps.ts";
import { getBenchmarks, workdir } from "./misc.ts";

const prelude =
  `# This workflow was automatically generated by tool/generate_workflow.ts
# Please do not edit manually, instead run deno task generate_workflow\n\n`;

// deno-lint-ignore no-explicit-any
const setup: any = {
  name: "bench",
  on: {
    schedule: [{ cron: "0 0 * * *" }],
    push: {
      paths: [
        "**.ts",
        "**.js",
        "**.tsx",
        "**.jsx",
        "**.yml",
        "**.json",
      ],
    },
  },
  jobs: {},
};

if (import.meta.main) {
  const { benchmarks } = await getBenchmarks();

  const workflow = setup;
  const jobs = [];
  const loadCaches = [];

  for (const [identifier, benchmark] of Object.entries(benchmarks)) {
    workflow.jobs[identifier] = {
      name: benchmark.name,
      "runs-on": "ubuntu-latest",
      steps: [
        {
          name: "Checkout Repository",
          uses: "actions/checkout@v3",
          with: { "persist-credentials": false, "fetch-depth": 0 },
        },
        {
          name: "Install Deno",
          uses: "denoland/setup-deno@v1",
        },
        {
          name: "Install Node",
          uses: "actions/setup-node@v3",
        },
        {
          name: "Install Bun",
          uses: "antongolub/action-setup-bun@v1"
        },
        {
          name: "Install Autocannon",
          run: "npm install -g autocannon",
        },
        {
          name: "Run Benchmark",
          run: `deno task benchmark ${identifier}`,
        },
        {
          name: `Save ${identifier} results`,
          id: `${identifier}-results`,
          uses: "actions/cache@v3",
          with: {
            path: `frameworks/*/results/${identifier}.json`,
            key: `${identifier}-results`,
          },
        },
      ],
    };

    jobs.push(identifier);
    loadCaches.push({
      name: `Load ${identifier} results`,
      id: `${identifier}-results`,
      uses: "actions/cache@v3",
      with: {
        path: `frameworks/*/results/${identifier}.json`,
        key: `${identifier}-results`,
      },
    });
  }

  workflow.jobs["finish"] = {
    name: "Finish",
    "runs-on": "ubuntu-latest",
    needs: [...jobs],
    steps: [
      {
        name: "Checkout Repository",
        uses: "actions/checkout@v3",
        with: { "persist-credentials": false, "fetch-depth": 0 },
      },
      ...loadCaches,
      {
        name: "Install Deno",
        uses: "denoland/setup-deno@v1",
      },
      {
        name: "Generate README.md",
        run: `deno task readme`,
      },
      {
        name: "Push changes",
        uses: "actions-js/push@v1",
        with: {
          github_token: "${{ secrets.GITHUB_TOKEN }}",
          branch: "main",
        },
      },
    ],
  };

  const output = prelude + stringify(workflow, {
    lineWidth: Number.POSITIVE_INFINITY,
  });

  await Deno.writeTextFile(
    join(workdir, ".github", "workflows", "workflow.yml"),
    output,
  );
}
