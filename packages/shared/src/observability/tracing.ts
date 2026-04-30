// OTel tracing — opt-in via OTEL_ENABLED=true

let tracingInitialized = false;

export async function initTracing(appName: string): Promise<void> {
  if (process.env.OTEL_ENABLED !== 'true') return;
  if (tracingInitialized) return;

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { PrismaInstrumentation } = await import('@prisma/instrumentation');
    
    const sdk = new NodeSDK({
      serviceName: appName,
      instrumentations: [new PrismaInstrumentation()],
    });

    await sdk.start();
    tracingInitialized = true;
    console.log(`OTel tracing started for ${appName}`);
  } catch (error) {
    console.warn('OTel tracing failed to start (deps may not be installed):', error);
  }
}