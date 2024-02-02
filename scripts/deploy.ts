async function main() {
  console.log("todo");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
