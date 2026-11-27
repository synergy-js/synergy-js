import { render } from "solid-js/web";
import "./styles.css";
import { App } from "./app.tsx";

const root = document.getElementById("root");

if (root) {
  render(() => <App />, root);
}
