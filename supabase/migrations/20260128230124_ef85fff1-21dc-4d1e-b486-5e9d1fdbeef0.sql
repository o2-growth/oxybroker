-- Migrar dados existentes de 'mlq' para 'mql' (agora que o enum foi commitado)
UPDATE public.assets SET asset_type = 'mql' WHERE asset_type = 'mlq';
UPDATE public.category_asset_availability SET asset_type = 'mql' WHERE asset_type = 'mlq';