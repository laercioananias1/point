# Infra

Ainda não implementado — planejado para quando o MVP núcleo estiver validado
localmente. Ver seção 8 do plano de arquitetura (RDS, ECS Fargate, S3 +
CloudFront, ECR, EventBridge Scheduler para o fechamento mensal).

Estrutura prevista:

```
infra/
├── terraform/          # RDS, ECS, ECR, CloudFront, S3
└── github-actions/     # workflows de build/push/deploy
```
