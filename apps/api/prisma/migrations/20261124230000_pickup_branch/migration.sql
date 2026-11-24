-- Sucursal donde el cliente retira el pedido (D-083): "chile" o "san-juan". Sin dato: la del servicio.
ALTER TABLE "JobOrder" ADD COLUMN "pickupBranch" TEXT;
