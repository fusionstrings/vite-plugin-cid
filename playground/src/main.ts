import "./style.css";
async function main() {
	const { vendorName } = await import("./vendor");

	console.log("Using vendor:", vendorName);

	// Display the current script's source (which contains the CID)
	const script = document.querySelector('script[type="module"]');
	const display = document.querySelector("#cid-display");

	if (script && display) {
		const src = script.getAttribute("src");
		if (src) {
			display.textContent = `Current Script: ${src}`;

			// Extract CID if present (simple regex check)
			const cidMatch = src.match(/bafkrei[a-z0-9]+/);
			if (cidMatch) {
				display.innerHTML +=
					`<br><br><span style="color: #4ade80">✓ Verified CID: ${cidMatch[0]
					}</span>`;
			}
		}
	}

	// Add a button to test dynamic import (which should generate a chunk)
	const btn = document.createElement("button");
	btn.textContent = "Load Dynamic Chunk";
	btn.style.marginTop = "1rem";
	btn.style.padding = "0.5rem 1rem";
	btn.style.background = "#3B82F6";
	btn.style.color = "white";
	btn.style.border = "none";
	btn.style.borderRadius = "0.5rem";
	btn.style.cursor = "pointer";

	btn.addEventListener("click", async () => {
		const module = await import("./dynamic");
		console.log(module.msg);
		alert(module.msg);
	});

	document.querySelector(".demo-section")?.appendChild(btn);

	console.log("CID Vite Plugin Playground Loaded");
}
main();
