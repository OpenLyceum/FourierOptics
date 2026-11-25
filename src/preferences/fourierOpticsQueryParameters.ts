import { logGlobal } from "scenerystack/phet-core";
import { QueryStringMachine } from "scenerystack/query-string-machine";
import { BACKEND_CHOICES, RESOLUTION_CHOICES } from "../FourierOpticsConstants.js";
import FourierOpticsNamespace from "../FourierOpticsNamespace.js";

const fourierOpticsQueryParameters = QueryStringMachine.getAll({
  backend: { type: "string", validValues: [...BACKEND_CHOICES], defaultValue: "auto", public: true },
  resolution: {
    type: "string",
    validValues: [null, ...RESOLUTION_CHOICES.map(String)],
    defaultValue: null,
    public: true,
  },
  timing: { type: "flag" },
});

FourierOpticsNamespace.register("fourierOpticsQueryParameters", fourierOpticsQueryParameters);
logGlobal("phet.chipper.queryParameters");

export default fourierOpticsQueryParameters;
