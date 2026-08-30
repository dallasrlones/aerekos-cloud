# Deploy icarus-assistant as a compute task

The assistant image lives in a **separate repo**. This cloud does not grow that tree.

System project only: `9d8bde11-6933-4732-b746-602dcf72eaa5`. Never the production app project.

## Enable git + CI

```
aerekos setup git_manager --project 9d8bde11-6933-4732-b746-602dcf72eaa5
aerekos setup cicd_manager --project 9d8bde11-6933-4732-b746-602dcf72eaa5
```

Pin git/cicd on **prod-mini**. Run the assistant task on **orin** if it needs local GPU/LLM.

## Create the task

```
aerekos call compute_manager POST /api/v1/tasks -P 9d8bde11-6933-4732-b746-602dcf72eaa5 -d '{
  "name": "icarus-assistant",
  "image": "icarus-assistant:pinned",
  "restart": "unless-stopped",
  "worker_id": "<orin-or-prod-worker-id>",
  "env": {
    "AEREKOS_API_URL": "https://cloudapi.aerekos.com",
    "AEREKOS_GIT_REMOTE": "https://cloudapi.aerekos.com/git/<project>/icarus-assistant.git"
  }
}'
```

Pull the image on that worker first (`docker load` or local registry). Restart policy `unless-stopped`. Bind a hostname after edge hookup.

This is “deploy the product onto the cloud,” not “the cloud deploys itself.”
