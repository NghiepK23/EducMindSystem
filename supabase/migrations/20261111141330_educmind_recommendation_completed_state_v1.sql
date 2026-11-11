-- Thêm trạng thái COMPLETED cho gợi ý học tập: gợi ý tự hoàn tất khi lỗ hổng kiến thức đã được lấp.
alter type public.recommendation_state add value if not exists 'COMPLETED';
