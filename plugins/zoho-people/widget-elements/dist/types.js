/**
 * Local mirror of the host's plugin contract.
 *
 * Plugins compile in isolation and don't have access to the myHubV2 workspace,
 * so we declare the minimum surface area we need here. The host
 * (`@myhub/widget-tokens`) re-exports an equivalent shape — values are
 * matched structurally at load time, not nominally.
 */
export {};
